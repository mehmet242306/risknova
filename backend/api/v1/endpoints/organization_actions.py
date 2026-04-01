from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from api.audit import write_audit_log
from api.authz import CurrentAppUser, require_roles, supabase_admin
from api.responses import success_response

router = APIRouter(prefix="/organization-actions", tags=["organization-actions"])


class OrganizationCreateRequest(BaseModel):
    name: str
    slug: str
    organization_type: str = "organization"
    country: str = "TR"
    city: str | None = None
    email: str | None = None


@router.post("")
async def create_organization(
    request: Request,
    payload: OrganizationCreateRequest,
    current_user: Annotated[
        CurrentAppUser,
        Depends(require_roles("Organization Admin")),
    ],
):
    create_data = payload.model_dump()

    response = supabase_admin.table("organizations").insert(create_data).execute()
    rows = response.data or []
    created_row = rows[0] if rows else None

    if not created_row:
        raise HTTPException(status_code=500, detail="Organization could not be created")

    await write_audit_log(
        current_user=current_user,
        action_type="organization_create",
        entity_type="organization",
        entity_id=str(created_row.get("id")),
        severity="info",
        metadata_json={
            "name": created_row.get("name"),
            "slug": created_row.get("slug"),
        },
        request=request,
    )

    return success_response(
        data={
            "message": "Organization created",
            "organization_id": created_row.get("id"),
            "name": created_row.get("name"),
            "slug": created_row.get("slug"),
        },
        meta={},
    )
