from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from api.audit import write_audit_log
from api.authz import CurrentAppUser, require_roles, supabase_admin
from api.responses import success_response

router = APIRouter(prefix="/profile-actions", tags=["profile-actions"])


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    title: str | None = None
    phone: str | None = None


@router.patch("/me")
async def update_my_profile(
    request: Request,
    payload: ProfileUpdateRequest,
    current_user: Annotated[
        CurrentAppUser,
        Depends(require_roles("Organization Admin", "OHS Specialist")),
    ],
):
    update_data = payload.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No profile fields were provided")

    response = (
        supabase_admin.table("user_profiles")
        .update(update_data)
        .eq("id", current_user.profile_id)
        .execute()
    )

    rows = response.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Profile could not be updated")

    await write_audit_log(
        current_user=current_user,
        action_type="profile_update",
        entity_type="user_profile",
        entity_id=current_user.profile_id,
        severity="info",
        metadata_json={
            "updated_fields": list(update_data.keys()),
        },
        request=request,
    )

    return success_response(
        data={
            "message": "Profile updated",
            "profile_id": current_user.profile_id,
            "updated_fields": list(update_data.keys()),
        },
        meta={},
    )
