from __future__ import annotations

from typing import Annotated, Callable, Literal

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
        supabase_admin.table("roles").select("name").in_("id", role_ids).execute()
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


PermissionLevel = Literal["none", "read", "write"]


def is_company_member(current_user: CurrentAppUser, company_identity_id: str) -> bool:
    rows = (
        supabase_admin.table("company_memberships")
        .select("id")
        .eq("company_identity_id", company_identity_id)
        .eq("user_id", current_user.auth_user_id)
        .in_("status", ["active", "approved"])
        .limit(1)
        .execute()
    ).data or []
    return bool(rows)


def can_manage_company(current_user: CurrentAppUser, company_identity_id: str) -> bool:
    rows = (
        supabase_admin.table("company_memberships")
        .select("membership_role,can_approve_join_requests,status")
        .eq("company_identity_id", company_identity_id)
        .eq("user_id", current_user.auth_user_id)
        .in_("status", ["active", "approved"])
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        return False

    row = rows[0]
    role = str(row.get("membership_role") or "").strip().lower()
    if role in {"owner", "admin"}:
        return True
    return bool(row.get("can_approve_join_requests"))


def require_company_member(
    company_identity_id: str, current_user: CurrentAppUser
) -> None:
    if not is_company_member(current_user, company_identity_id):
        raise forbidden("Not a company member")


def require_company_manager(
    company_identity_id: str, current_user: CurrentAppUser
) -> None:
    if not can_manage_company(current_user, company_identity_id):
        raise forbidden("Insufficient company-level permissions")


def get_member_module_permissions(
    company_identity_id: str, user_id: str
) -> dict[str, PermissionLevel]:
    membership_rows = (
        supabase_admin.table("company_memberships")
        .select("id")
        .eq("company_identity_id", company_identity_id)
        .eq("user_id", user_id)
        .in_("status", ["active", "approved"])
        .limit(1)
        .execute()
    ).data or []

    if not membership_rows:
        return {}

    membership_id = membership_rows[0]["id"]
    permission_rows = (
        supabase_admin.table("company_member_module_permissions")
        .select("module_key,permission_level")
        .eq("company_membership_id", membership_id)
        .execute()
    ).data or []

    output: dict[str, PermissionLevel] = {}
    for row in permission_rows:
        module_key = str(row.get("module_key") or "").strip()
        level = str(row.get("permission_level") or "").strip()
        if not module_key or level not in {"none", "read", "write"}:
            continue
        output[module_key] = level  # type: ignore[assignment]
    return output


def has_company_module_access(
    company_identity_id: str,
    user_id: str,
    module_key: str,
    required_level: PermissionLevel = "read",
) -> bool:
    permissions = get_member_module_permissions(company_identity_id, user_id)
    current = permissions.get(module_key, "none")
    rank = {"none": 0, "read": 1, "write": 2}
    return rank[current] >= rank[required_level]
