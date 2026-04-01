from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from api.audit import write_audit_log
from api.authz import (
    CurrentAppUser,
    require_company_manager,
    require_company_member,
    require_roles,
    supabase_admin,
)
from api.responses import success_response
from api.schemas.company_workspaces import (
    ArchiveCompanyRequest,
    CompanyWorkspaceCreateRequest,
    DeleteCompanyRequest,
    InvitationCreateRequest,
    InvitationDecisionRequest,
    InvitationRevokeRequest,
    JoinRequestByCodeRequest,
    JoinRequestDecisionRequest,
    MemberPermissionUpdateRequest,
)
from api.services.company_workspaces import (
    create_company_with_workspace,
    get_company_workspace_detail_for_user,
    list_company_workspaces_for_user,
)

router = APIRouter(prefix="/company-workspaces", tags=["company-workspaces"])


def _manager_roles() -> list[str]:
    return ["Organization Admin", "OHS Specialist"]


def _extract_supabase_error_detail(exc: Exception) -> str:
    message = str(exc)
    for attr in ("message", "detail", "args"):
        value = getattr(exc, attr, None)
        if value:
            message = str(value)
            break
    if not message:
        message = "Unknown Supabase error"
    return message


def _raise_db_error(prefix: str, exc: Exception, code: int = status.HTTP_500_INTERNAL_SERVER_ERROR) -> None:
    detail = _extract_supabase_error_detail(exc)
    raise HTTPException(status_code=code, detail=f"{prefix}: {detail}")


@router.get("")
async def list_company_workspaces(
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    rows = list_company_workspaces_for_user(current_user)
    return success_response(data={"items": rows}, meta={})


@router.get("/{company_identity_id}")
async def get_company_workspace_detail(
    company_identity_id: UUID,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    detail = get_company_workspace_detail_for_user(str(company_identity_id), current_user)
    return success_response(data=detail, meta={})


@router.post("/create")
async def create_company_workspace(
    request: Request,
    payload: CompanyWorkspaceCreateRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    created = create_company_with_workspace(payload.model_dump(), current_user)

    await write_audit_log(
        current_user=current_user,
        action_type="company_workspace.create",
        entity_type="company_identity",
        entity_id=str(created.get("company_identity_id")),
        severity="info",
        metadata_json={"workspace_id": created.get("workspace_id")},
        request=request,
    )

    return success_response(data={"created": created}, meta={})


@router.post("/join-requests/by-code")
async def create_join_request_by_code(
    request: Request,
    payload: JoinRequestByCodeRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    result = supabase_admin.rpc(
        "request_company_join_by_code",
        {
            "p_company_code": payload.company_code,
            "p_requested_role": payload.requested_role,
            "p_requested_employment_type": payload.requested_employment_type,
            "p_note": payload.note,
        },
    ).execute()

    await write_audit_log(
        current_user=current_user,
        action_type="company_join_request.create",
        entity_type="company_join_request",
        entity_id="rpc:request_company_join_by_code",
        severity="info",
        metadata_json={"company_code": payload.company_code},
        request=request,
    )

    return success_response(data={"result": result.data}, meta={})


@router.post("/join-requests/{join_request_id}/approve")
async def approve_join_request(
    join_request_id: str,
    request: Request,
    payload: JoinRequestDecisionRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    result = supabase_admin.rpc(
        "approve_company_join_request",
        {"p_join_request_id": join_request_id, "p_note": payload.note},
    ).execute()

    await write_audit_log(
        current_user=current_user,
        action_type="company_join_request.approve",
        entity_type="company_join_request",
        entity_id=join_request_id,
        severity="info",
        metadata_json={},
        request=request,
    )

    return success_response(data={"result": result.data}, meta={})


@router.post("/join-requests/{join_request_id}/reject")
async def reject_join_request(
    join_request_id: str,
    request: Request,
    payload: JoinRequestDecisionRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    result = supabase_admin.rpc(
        "reject_company_join_request",
        {"p_join_request_id": join_request_id, "p_note": payload.note},
    ).execute()

    await write_audit_log(
        current_user=current_user,
        action_type="company_join_request.reject",
        entity_type="company_join_request",
        entity_id=join_request_id,
        severity="warning",
        metadata_json={},
        request=request,
    )

    return success_response(data={"result": result.data}, meta={})


@router.post("/invitations")
async def create_company_invitation(
    request: Request,
    payload: InvitationCreateRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    require_company_manager(payload.company_identity_id, current_user)

    insert_resp = (
        supabase_admin.table("company_invitations")
        .insert(
            {
                "company_identity_id": payload.company_identity_id,
                "company_workspace_id": payload.company_workspace_id,
                "inviter_user_id": current_user.auth_user_id,
                "invitee_email": payload.invitee_email.strip().lower(),
                "message": payload.message,
                "expires_at": payload.expires_at.isoformat() if payload.expires_at else None,
            }
        )
        .execute()
    )
    rows = insert_resp.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Invitation could not be created")
    invitation = rows[0]

    permission_rows = [
        {
            "invitation_id": invitation["id"],
            "module_key": item.module_key,
            "permission_level": item.permission_level,
        }
        for item in payload.permissions
    ]
    supabase_admin.table("company_invitation_permissions").insert(permission_rows).execute()

    await write_audit_log(
        current_user=current_user,
        action_type="company_invitation.create",
        entity_type="company_invitation",
        entity_id=str(invitation["id"]),
        severity="info",
        metadata_json={"permission_count": len(permission_rows)},
        request=request,
    )

    return success_response(data={"invitation": invitation}, meta={})


@router.get("/invitations")
async def list_company_invitations(
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
    company_identity_id: str | None = None,
):
    query = supabase_admin.table("company_invitations").select("*").order("created_at", desc=True)
    if company_identity_id:
        query = query.eq("company_identity_id", company_identity_id)
    rows = query.execute().data or []
    return success_response(data={"items": rows}, meta={})


@router.post("/invitations/{invitation_id}/accept")
async def accept_invitation(
    invitation_id: str,
    request: Request,
    payload: InvitationDecisionRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    result = supabase_admin.rpc(
        "accept_company_invitation",
        {"p_invitation_id": invitation_id, "p_note": payload.note},
    ).execute()

    await write_audit_log(
        current_user=current_user,
        action_type="company_invitation.accept",
        entity_type="company_invitation",
        entity_id=invitation_id,
        severity="info",
        metadata_json={},
        request=request,
    )

    return success_response(data={"membership_id": result.data}, meta={})


@router.post("/invitations/{invitation_id}/decline")
async def decline_invitation(
    invitation_id: str,
    request: Request,
    payload: InvitationDecisionRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    supabase_admin.rpc(
        "decline_company_invitation",
        {"p_invitation_id": invitation_id, "p_note": payload.note},
    ).execute()

    await write_audit_log(
        current_user=current_user,
        action_type="company_invitation.decline",
        entity_type="company_invitation",
        entity_id=invitation_id,
        severity="warning",
        metadata_json={},
        request=request,
    )

    return success_response(data={"status": "declined"}, meta={})


@router.post("/invitations/{invitation_id}/revoke")
async def revoke_invitation(
    invitation_id: str,
    request: Request,
    payload: InvitationRevokeRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    invitation_rows = (
        supabase_admin.table("company_invitations")
        .select("company_identity_id")
        .eq("id", invitation_id)
        .limit(1)
        .execute()
    ).data or []
    if not invitation_rows:
        raise HTTPException(status_code=404, detail="Invitation not found")

    require_company_manager(str(invitation_rows[0]["company_identity_id"]), current_user)

    supabase_admin.rpc(
        "revoke_company_invitation",
        {"p_invitation_id": invitation_id, "p_note": payload.note},
    ).execute()

    await write_audit_log(
        current_user=current_user,
        action_type="company_invitation.revoke",
        entity_type="company_invitation",
        entity_id=invitation_id,
        severity="warning",
        metadata_json={},
        request=request,
    )

    return success_response(data={"status": "revoked"}, meta={})


@router.get("/{company_identity_id}/members")
async def list_company_members(
    company_identity_id: UUID,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    require_company_member(str(company_identity_id), current_user)

    rows = (
        supabase_admin.table("company_memberships")
        .select("*")
        .eq("company_identity_id", str(company_identity_id))
        .order("created_at", desc=False)
        .execute()
    ).data or []

    return success_response(data={"items": rows}, meta={})


@router.get("/{company_identity_id}/member-permissions")
async def list_member_permissions(
    company_identity_id: UUID,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    require_company_member(str(company_identity_id), current_user)

    try:
        memberships = (
            supabase_admin.table("company_memberships")
            .select("id,user_id,membership_role,status")
            .eq("company_identity_id", str(company_identity_id))
            .in_("status", ["active", "approved"])
            .execute()
        ).data or []
    except Exception as exc:
        _raise_db_error("Failed to read company memberships", exc)

    result = []
    for membership in memberships:
        membership_id = str(membership.get("id") or "")
        if not membership_id:
            result.append({"membership": membership, "permissions": {}})
            continue

        try:
            permission_rows = (
                supabase_admin.table("company_member_module_permissions")
                .select("module_key,permission_level")
                .eq("company_membership_id", membership_id)
                .execute()
            ).data or []
        except Exception as exc:
            _raise_db_error("Failed to read company_member_module_permissions", exc)

        permissions: dict[str, str] = {}
        for row in permission_rows:
            module_key = str(row.get("module_key") or "").strip()
            permission_level = str(row.get("permission_level") or "").strip()
            if not module_key:
                continue
            if permission_level not in {"none", "read", "write"}:
                continue
            permissions[module_key] = permission_level

        result.append({"membership": membership, "permissions": permissions})

    return success_response(data={"items": result}, meta={})


@router.put("/{company_identity_id}/member-permissions/{membership_id}")
async def update_member_permissions(
    company_identity_id: UUID,
    membership_id: str,
    request: Request,
    payload: MemberPermissionUpdateRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    require_company_manager(str(company_identity_id), current_user)

    membership_rows = (
        supabase_admin.table("company_memberships")
        .select("id,company_identity_id")
        .eq("id", membership_id)
        .limit(1)
        .execute()
    ).data or []
    if not membership_rows:
        raise HTTPException(status_code=404, detail="Membership not found")
    if str(membership_rows[0]["company_identity_id"]) != str(company_identity_id):
        raise HTTPException(status_code=400, detail="Membership-company mismatch")

    supabase_admin.table("company_member_module_permissions").delete().eq(
        "company_membership_id", membership_id
    ).execute()

    insert_rows = [
        {
            "company_membership_id": membership_id,
            "company_identity_id": str(company_identity_id),
            "module_key": p.module_key,
            "permission_level": p.permission_level,
            "granted_by_user_id": current_user.auth_user_id,
        }
        for p in payload.permissions
    ]
    if insert_rows:
        supabase_admin.table("company_member_module_permissions").insert(insert_rows).execute()

    await write_audit_log(
        current_user=current_user,
        action_type="company_member_permissions.update",
        entity_type="company_membership",
        entity_id=membership_id,
        severity="info",
        metadata_json={"permission_count": len(insert_rows)},
        request=request,
    )

    return success_response(data={"updated": True, "count": len(insert_rows)}, meta={})


@router.post("/{company_identity_id}/archive")
async def archive_company_identity(
    company_identity_id: UUID,
    request: Request,
    payload: ArchiveCompanyRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    company_identity_id_str = str(company_identity_id)
    require_company_manager(company_identity_id_str, current_user)

    try:
        rpc_response = supabase_admin.rpc(
            "archive_company_identity",
            {
                "p_company_identity_id": company_identity_id_str,
                "p_note": payload.note,
                "p_actor_user_id": current_user.auth_user_id,
            },
        ).execute()
    except Exception as exc:
        _raise_db_error("archive_company_identity RPC failed", exc)

    await write_audit_log(
        current_user=current_user,
        action_type="company_identity.archive",
        entity_type="company_identity",
        entity_id=company_identity_id_str,
        severity="warning",
        metadata_json={"rpc_result": rpc_response.data},
        request=request,
    )

    return success_response(data={"status": "archived", "rpc_result": rpc_response.data}, meta={})


@router.post("/{company_identity_id}/delete-request")
async def request_company_delete(
    company_identity_id: UUID,
    request: Request,
    payload: DeleteCompanyRequest,
    current_user: Annotated[CurrentAppUser, Depends(require_roles(*_manager_roles()))],
):
    company_identity_id_str = str(company_identity_id)
    require_company_manager(company_identity_id_str, current_user)

    try:
        rpc_response = supabase_admin.rpc(
            "request_company_delete",
            {
                "p_company_identity_id": company_identity_id_str,
                "p_note": payload.note,
                "p_actor_user_id": current_user.auth_user_id,
            },
        ).execute()
    except Exception as exc:
        _raise_db_error("request_company_delete RPC failed", exc)

    await write_audit_log(
        current_user=current_user,
        action_type="company_identity.delete_request",
        entity_type="company_identity",
        entity_id=company_identity_id_str,
        severity="critical",
        metadata_json={"rpc_result": rpc_response.data},
        request=request,
    )

    return success_response(data={"status": "delete_requested", "rpc_result": rpc_response.data}, meta={})








