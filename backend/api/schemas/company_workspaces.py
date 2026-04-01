from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

PermissionLevel = Literal["none", "read", "write"]
InvitationStatus = Literal["pending", "accepted", "declined", "revoked", "expired"]
JoinRequestStatus = Literal["pending", "approved", "rejected", "cancelled"]


class CompanyPermissionItem(BaseModel):
    module_key: str = Field(min_length=1, max_length=120)
    permission_level: PermissionLevel


class CompanyWorkspaceCreateRequest(BaseModel):
    official_name: str = Field(min_length=2, max_length=255)
    tax_number: str | None = Field(default=None, max_length=50)
    mersis_number: str | None = Field(default=None, max_length=50)
    sector: str | None = Field(default=None, max_length=120)
    nace_code: str | None = Field(default=None, max_length=50)
    hazard_class: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=500)
    city: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    display_name: str = Field(min_length=2, max_length=255)
    notes: str | None = None


class JoinRequestByCodeRequest(BaseModel):
    company_code: str = Field(min_length=3, max_length=50)
    requested_role: str = Field(min_length=2, max_length=80, default="viewer")
    requested_employment_type: str = Field(
        min_length=2, max_length=80, default="external"
    )
    note: str | None = None


class JoinRequestDecisionRequest(BaseModel):
    note: str | None = None


class InvitationCreateRequest(BaseModel):
    company_identity_id: str
    company_workspace_id: str | None = None
    invitee_email: str = Field(min_length=5, max_length=320)
    message: str | None = None
    expires_at: datetime | None = None
    permissions: list[CompanyPermissionItem] = Field(min_length=1)


class InvitationDecisionRequest(BaseModel):
    note: str | None = None


class InvitationRevokeRequest(BaseModel):
    note: str | None = None


class MemberPermissionUpdateRequest(BaseModel):
    permissions: list[CompanyPermissionItem] = Field(min_length=1)


class ArchiveCompanyRequest(BaseModel):
    note: str | None = None


class DeleteCompanyRequest(BaseModel):
    note: str | None = None
