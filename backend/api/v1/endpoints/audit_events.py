from typing import Annotated

from fastapi import APIRouter, Depends, Request

from api.audit import write_audit_log
from api.authz import CurrentAppUser, get_current_app_user
from api.responses import success_response

router = APIRouter(prefix="/audit-events", tags=["audit"])


@router.post("/login")
async def log_login_event(
    request: Request,
    current_user: Annotated[CurrentAppUser, Depends(get_current_app_user)],
):
    log_row = await write_audit_log(
        current_user=current_user,
        action_type="login",
        entity_type="auth_session",
        entity_id=current_user.auth_user_id,
        severity="info",
        metadata_json={
            "email": current_user.email,
            "roles": current_user.roles,
        },
        request=request,
    )

    return success_response(
        data={
            "message": "Login audit log written",
            "log_id": log_row.get("id"),
        },
        meta={},
    )