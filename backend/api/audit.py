from __future__ import annotations

from typing import Any

from fastapi import Request

from api.authz import CurrentAppUser, supabase_admin


def _get_client_ip(request: Request | None) -> str | None:
    if request is None or request.client is None:
        return None
    return request.client.host


def _get_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    return request.headers.get("user-agent")


async def write_audit_log(
    *,
    current_user: CurrentAppUser | None,
    action_type: str,
    entity_type: str,
    entity_id: str | None = None,
    severity: str = "info",
    metadata_json: dict[str, Any] | None = None,
    request: Request | None = None,
) -> dict[str, Any]:
    if current_user is None:
        raise ValueError("current_user is required for audit logging")

    payload = {
        "organization_id": current_user.organization_id,
        "tenant_id": None,
        "actor_user_profile_id": current_user.profile_id,
        "user_id": current_user.auth_user_id,
        "action_type": action_type,
        "action": action_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "severity": severity,
        "metadata_json": metadata_json or {},
        "old_values": {},
        "new_values": metadata_json or {},
        "ip_address": _get_client_ip(request),
        "user_agent": _get_user_agent(request),
        "created_by": current_user.auth_user_id,
        "updated_by": current_user.auth_user_id,
    }

    response = supabase_admin.table("audit_logs").insert(payload).execute()
    rows = response.data or []
    return rows[0] if rows else payload
