from __future__ import annotations

from uuid import uuid4

from fastapi import HTTPException

from api.authz import CurrentAppUser, supabase_admin


def _value_or_none(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_hazard_class(value: object) -> str | None:
    text = _value_or_none(value)
    if not text:
        return None

    normalized = text.lower()
    mapping = {
        "az tehlikeli": "Az Tehlikeli",
        "tehlikeli": "Tehlikeli",
        "cok tehlikeli": "Çok Tehlikeli",
        "çok tehlikeli": "Çok Tehlikeli",
    }
    return mapping.get(normalized, text)


def _generate_company_code() -> str:
    return f"RN-CMP-{uuid4().hex[:6].upper()}"


def list_company_workspaces_for_user(current_user: CurrentAppUser) -> list[dict]:
    response = (
        supabase_admin.table("company_workspaces")
        .select("*")
        .eq("organization_id", current_user.organization_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


def get_company_workspace_detail_for_user(
    company_identity_id: str, current_user: CurrentAppUser
) -> dict:
    workspace_rows = (
        supabase_admin.table("company_workspaces")
        .select("*")
        .eq("organization_id", current_user.organization_id)
        .eq("company_identity_id", company_identity_id)
        .limit(1)
        .execute()
    ).data or []

    if not workspace_rows:
        raise HTTPException(status_code=404, detail="Company workspace not found")

    company_rows = (
        supabase_admin.table("company_identities")
        .select("*")
        .eq("id", company_identity_id)
        .limit(1)
        .execute()
    ).data or []

    if not company_rows:
        raise HTTPException(status_code=404, detail="Company identity not found")

    return {
        "company_identity": company_rows[0],
        "workspace": workspace_rows[0],
    }


def create_company_with_workspace(payload: dict, current_user: CurrentAppUser) -> dict:
    official_name = _value_or_none(payload.get("official_name"))
    display_name = _value_or_none(payload.get("display_name")) or official_name

    if not official_name:
        raise HTTPException(status_code=400, detail="official_name is required")

    company_insert = {
        "company_code": _generate_company_code(),
        "official_name": official_name,
        "tax_number": _value_or_none(payload.get("tax_number")),
        "mersis_number": _value_or_none(payload.get("mersis_number")),
        "sector": _value_or_none(payload.get("sector")),
        "nace_code": _value_or_none(payload.get("nace_code")),
        "hazard_class": _normalize_hazard_class(payload.get("hazard_class")),
        "address": _value_or_none(payload.get("address")),
        "city": _value_or_none(payload.get("city")),
        "district": _value_or_none(payload.get("district")),
        "approval_mode": "single_approver",
        "is_active": True,
        "owner_organization_id": current_user.organization_id,
        "created_by": current_user.auth_user_id,
        "updated_by": current_user.auth_user_id,
    }

    company_resp = (
        supabase_admin.table("company_identities").insert(company_insert).execute()
    )
    company_rows = company_resp.data or []
    if not company_rows:
        raise HTTPException(
            status_code=500, detail="Company identity could not be created"
        )

    company = company_rows[0]

    workspace_insert = {
        "organization_id": current_user.organization_id,
        "company_identity_id": company["id"],
        "display_name": display_name,
        "notes": _value_or_none(payload.get("notes"))
        or f"{official_name} için firma çalışma alanı üzerinden oluşturuldu.",
        "is_primary_workspace": True,
        "created_by": current_user.auth_user_id,
        "updated_by": current_user.auth_user_id,
    }

    workspace_resp = (
        supabase_admin.table("company_workspaces").insert(workspace_insert).execute()
    )
    workspace_rows = workspace_resp.data or []
    if not workspace_rows:
        supabase_admin.table("company_identities").delete().eq(
            "id", company["id"]
        ).execute()
        raise HTTPException(
            status_code=500, detail="Company workspace could not be created"
        )

    workspace = workspace_rows[0]

    membership_resp = (
        supabase_admin.table("company_memberships")
        .insert(
            {
                "company_identity_id": company["id"],
                "organization_id": current_user.organization_id,
                "user_id": current_user.auth_user_id,
                "membership_role": "owner",
                "status": "active",
                "can_approve_join_requests": True,
            }
        )
        .execute()
    )

    if membership_resp.data is None:
        raise HTTPException(
            status_code=500, detail="Company membership could not be created"
        )

    return {
        "company_identity_id": str(company["id"]),
        "company_code": company.get("company_code"),
        "workspace_id": str(workspace["id"]),
        "display_name": workspace.get("display_name"),
    }
