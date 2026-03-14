from __future__ import annotations

from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from supabase import Client, create_client

from config import settings


if not settings.supabase_url or not settings.supabase_service_role_key:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")


supabase_admin: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key,
)

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentAppUser(BaseModel):
    auth_user_id: str
    email: str | None = None
    profile_id: str
    organization_id: str
    roles: list[str]


def unauthorized(detail: str = "Authentication required") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
    )


def forbidden(detail: str = "Forbidden") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detail,
    )


async def get_access_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> str:
    if credentials is None:
        raise unauthorized("Missing Authorization header")

    if credentials.scheme.lower() != "bearer":
        raise unauthorized("Invalid authentication scheme")

    token = credentials.credentials.strip()
    if not token:
        raise unauthorized("Missing access token")

    return token


async def get_current_app_user(
    access_token: Annotated[str, Depends(get_access_token)],
) -> CurrentAppUser:
    try:
        user_response = supabase_admin.auth.get_user(access_token)
    except Exception:
        raise unauthorized("Invalid or expired access token")

    auth_user = getattr(user_response, "user", None)
    if auth_user is None:
        raise unauthorized("User could not be resolved")

    auth_user_id = str(auth_user.id)
    email = getattr(auth_user, "email", None)

    profile_result = (
        supabase_admin.table("user_profiles")
        .select("id, organization_id, email")
        .eq("auth_user_id", auth_user_id)
        .limit(1)
        .execute()
    )

    profile_rows = profile_result.data or []
    if not profile_rows:
        raise forbidden("user_profiles record was not found")

    profile = profile_rows[0]
    profile_id = str(profile["id"])
    organization_id = profile.get("organization_id")

    if not organization_id:
        raise forbidden("User is not attached to an organization")

    user_roles_result = (
        supabase_admin.table("user_roles")
        .select("role_id")
        .eq("user_profile_id", profile_id)
        .execute()
    )

    user_role_rows = user_roles_result.data or []
    role_ids = [row["role_id"] for row in user_role_rows if row.get("role_id")]

    if not role_ids:
        raise forbidden("No role is assigned to this user")

    roles_result = (
        supabase_admin.table("roles")
        .select("name")
        .in_("id", role_ids)
        .execute()
    )

    role_rows = roles_result.data or []
    roles = [row["name"] for row in role_rows if row.get("name")]

    if not roles:
        raise forbidden("Role names could not be resolved")

    return CurrentAppUser(
        auth_user_id=auth_user_id,
        email=email or profile.get("email"),
        profile_id=profile_id,
        organization_id=str(organization_id),
        roles=roles,
    )


def require_roles(*allowed_roles: str) -> Callable:
    allowed = {role.strip() for role in allowed_roles if role.strip()}

    async def dependency(
        current_user: Annotated[CurrentAppUser, Depends(get_current_app_user)],
    ) -> CurrentAppUser:
        if not allowed.intersection(set(current_user.roles)):
            raise forbidden("Insufficient role")
        return current_user

    return dependency