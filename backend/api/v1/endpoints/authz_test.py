from typing import Annotated

from fastapi import APIRouter, Depends

from api.authz import CurrentAppUser, get_current_app_user, require_roles
from api.responses import success_response

router = APIRouter(prefix="/authz-test", tags=["authz-test"])


@router.get("/me")
async def me(
    current_user: Annotated[CurrentAppUser, Depends(get_current_app_user)],
):
    return success_response(
        data={
            "auth_user_id": current_user.auth_user_id,
            "email": current_user.email,
            "profile_id": current_user.profile_id,
            "organization_id": current_user.organization_id,
            "roles": current_user.roles,
        },
        meta={},
    )


@router.get("/admin-only")
async def admin_only(
    current_user: Annotated[
        CurrentAppUser,
        Depends(require_roles("Organization Admin")),
    ],
):
    return success_response(
        data={
            "message": "Admin access granted",
            "email": current_user.email,
            "roles": current_user.roles,
        },
        meta={},
    )


@router.get("/professional-or-admin")
async def professional_or_admin(
    current_user: Annotated[
        CurrentAppUser,
        Depends(require_roles("Organization Admin", "OHS Specialist")),
    ],
):
    return success_response(
        data={
            "message": "Professional/Admin access granted",
            "email": current_user.email,
            "roles": current_user.roles,
        },
        meta={},
    )