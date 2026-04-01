from __future__ import annotations

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from api.audit import write_audit_log
from api.authz import CurrentAppUser, require_roles, supabase_admin
from api.responses import success_response
from api.risk_ai import build_assessment_ai_summary, build_item_ai_output
from api.risk_engine import calculate_item_scores, summarize_assessment_results

router = APIRouter(prefix="/risk-assessments", tags=["risk-assessments"])


class RiskAssessmentItemCreateRequest(BaseModel):
    sort_order: int = Field(default=1, ge=1)
    hazard_title: str = Field(min_length=3, max_length=255)
    hazard_description: str = Field(min_length=3)
    activity_text: str | None = None
    location_text: str | None = None
    current_controls: str | None = None

    manual_probability: int = Field(ge=1, le=5)
    manual_severity: int = Field(ge=1, le=5)
    manual_exposure: int = Field(ge=1, le=5)

    gamma: float = Field(default=1.0, gt=0, le=5.0)

    c1: float = Field(default=0.0, ge=0.0, le=1.0)
    c2: float = Field(default=0.0, ge=0.0, le=1.0)
    c3: float = Field(default=0.0, ge=0.0, le=1.0)
    c4: float = Field(default=0.0, ge=0.0, le=1.0)
    c5: float = Field(default=0.0, ge=0.0, le=1.0)
    c6: float = Field(default=0.0, ge=0.0, le=1.0)
    c7: float = Field(default=0.0, ge=0.0, le=1.0)
    c8: float = Field(default=0.0, ge=0.0, le=1.0)
    c9: float = Field(default=0.0, ge=0.0, le=1.0)


class RiskAssessmentCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    reference_code: str | None = Field(default=None, max_length=100)
    assessment_date: date
    workplace_name: str | None = Field(default=None, max_length=255)
    department_name: str | None = Field(default=None, max_length=255)
    location_text: str | None = None
    activity_text: str | None = None
    notes: str | None = None
    items: list[RiskAssessmentItemCreateRequest] = Field(min_length=1)


def _organization_name(organization_id: str) -> str | None:
    response = (
        supabase_admin.table("organizations")
        .select("name")
        .eq("id", organization_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        return None
    return rows[0].get("name")


def _build_pdf_payload(
    *,
    organization_name: str | None,
    assessment: dict[str, Any],
    items: list[dict[str, Any]],
    prepared_by_email: str | None,
) -> dict[str, Any]:
    pdf_items = [
        {
            "sort_order": item.get("sort_order"),
            "hazard_title": item.get("hazard_title"),
            "hazard_description": item.get("hazard_description"),
            "activity_text": item.get("activity_text"),
            "location_text": item.get("location_text"),
            "current_controls": item.get("current_controls"),
            "normalized_score": item.get("normalized_score"),
            "risk_level": item.get("risk_level"),
            "ai_comment": item.get("ai_comment"),
            "ai_actions": item.get("ai_actions") or [],
        }
        for item in items
    ]

    return {
        "organization": {
            "name": organization_name,
        },
        "assessment_meta": {
            "title": assessment.get("title"),
            "reference_code": assessment.get("reference_code"),
            "assessment_date": assessment.get("assessment_date"),
            "workplace_name": assessment.get("workplace_name"),
            "department_name": assessment.get("department_name"),
            "location_text": assessment.get("location_text"),
            "activity_text": assessment.get("activity_text"),
        },
        "score_summary": {
            "overall_score": assessment.get("overall_score"),
            "overall_risk_level": assessment.get("overall_risk_level"),
            "highest_item_score": assessment.get("highest_item_score"),
            "highest_risk_level": assessment.get("highest_risk_level"),
        },
        "ai_summary": assessment.get("ai_summary"),
        "items": pdf_items,
        "signatures": {
            "prepared_by": prepared_by_email or "",
            "approved_by": "",
        },
    }


def _required_roles() -> list[str]:
    return ["Organization Admin", "OHS Specialist"]


@router.post("")
async def create_risk_assessment(
    request: Request,
    payload: RiskAssessmentCreateRequest,
    current_user: Annotated[
        CurrentAppUser,
        Depends(require_roles(*_required_roles())),
    ],
):
    scored_items: list[dict[str, Any]] = []

    for item in payload.items:
        item_payload = item.model_dump()
        score_data = calculate_item_scores(item_payload)
        ai_data = build_item_ai_output(
            hazard_title=item_payload["hazard_title"],
            hazard_description=item_payload["hazard_description"],
            current_controls=item_payload.get("current_controls"),
            risk_level=score_data["risk_level"],
            normalized_score=float(score_data["normalized_score"]),
            dominant_factors=score_data["dominant_factors"],
        )

        scored_items.append(
            {
                **item_payload,
                **{
                    key: value
                    for key, value in score_data.items()
                    if key != "dominant_factors"
                },
                **ai_data,
            }
        )

    assessment_summary = summarize_assessment_results(scored_items)
    ai_summary = build_assessment_ai_summary(
        title=payload.title,
        item_results=scored_items,
        overall_risk_level=str(assessment_summary["overall_risk_level"]),
    )

    assessment_insert = {
        "organization_id": current_user.organization_id,
        "created_by_user_id": current_user.auth_user_id,
        "updated_by_user_id": current_user.auth_user_id,
        "title": payload.title,
        "reference_code": payload.reference_code,
        "status": "completed",
        "assessment_date": payload.assessment_date.isoformat(),
        "workplace_name": payload.workplace_name,
        "department_name": payload.department_name,
        "location_text": payload.location_text,
        "activity_text": payload.activity_text,
        "notes": payload.notes,
        "method_version": "r-skor-v1",
        "item_count": assessment_summary["item_count"],
        "overall_score": assessment_summary["overall_score"],
        "overall_risk_level": assessment_summary["overall_risk_level"],
        "highest_item_score": assessment_summary["highest_item_score"],
        "highest_risk_level": assessment_summary["highest_risk_level"],
        "ai_summary": ai_summary,
        "pdf_payload_version": "v1",
    }

    assessment_response = (
        supabase_admin.table("risk_assessments").insert(assessment_insert).execute()
    )
    assessment_rows = assessment_response.data or []
    created_assessment = assessment_rows[0] if assessment_rows else None

    if not created_assessment:
        raise HTTPException(
            status_code=500, detail="Risk assessment could not be created"
        )

    assessment_id = str(created_assessment["id"])

    item_insert_rows = [
        {
            "assessment_id": assessment_id,
            "organization_id": current_user.organization_id,
            **item,
        }
        for item in scored_items
    ]

    items_response = (
        supabase_admin.table("risk_assessment_items").insert(item_insert_rows).execute()
    )
    created_items = items_response.data or []

    organization_name = _organization_name(current_user.organization_id)
    pdf_payload = _build_pdf_payload(
        organization_name=organization_name,
        assessment=created_assessment,
        items=created_items,
        prepared_by_email=current_user.email,
    )

    await write_audit_log(
        current_user=current_user,
        action_type="risk_assessment.created",
        entity_type="risk_assessment",
        entity_id=assessment_id,
        severity="info",
        metadata_json={
            "title": created_assessment.get("title"),
            "overall_score": created_assessment.get("overall_score"),
            "overall_risk_level": created_assessment.get("overall_risk_level"),
            "item_count": created_assessment.get("item_count"),
        },
        request=request,
    )

    return success_response(
        data={
            "assessment": created_assessment,
            "items": created_items,
            "pdf_payload": pdf_payload,
        },
        meta={},
    )


@router.get("")
async def list_risk_assessments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: Annotated[
        CurrentAppUser,
        Depends(require_roles(*_required_roles())),
    ] = None,
):
    query = (
        supabase_admin.table("risk_assessments")
        .select(
            "id,title,reference_code,assessment_date,status,workplace_name,department_name,item_count,overall_score,overall_risk_level,highest_item_score,highest_risk_level,created_at",
            count="exact",
        )
        .eq("organization_id", current_user.organization_id)
    )

    if status:
        query = query.eq("status", status)

    if risk_level:
        query = query.eq("overall_risk_level", risk_level)

    if date_from:
        query = query.gte("assessment_date", date_from.isoformat())

    if date_to:
        query = query.lte("assessment_date", date_to.isoformat())

    if search:
        safe_search = search.replace(",", " ").strip()
        if safe_search:
            query = query.or_(
                ",".join(
                    [
                        f"title.ilike.%{safe_search}%",
                        f"reference_code.ilike.%{safe_search}%",
                        f"workplace_name.ilike.%{safe_search}%",
                        f"department_name.ilike.%{safe_search}%",
                    ]
                )
            )

    range_from = (page - 1) * page_size
    range_to = range_from + page_size - 1

    response = (
        query.order("assessment_date", desc=True)
        .order("created_at", desc=True)
        .range(range_from, range_to)
        .execute()
    )

    rows = response.data or []
    total = getattr(response, "count", None)
    if total is None:
        total = len(rows)

    total_pages = max(1, (int(total) + page_size - 1) // page_size) if total else 1

    return success_response(
        data={
            "items": rows,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
            },
        },
        meta={},
    )


@router.get("/{assessment_id}")
async def get_risk_assessment_detail(
    assessment_id: str,
    current_user: Annotated[
        CurrentAppUser,
        Depends(require_roles(*_required_roles())),
    ],
):
    assessment_response = (
        supabase_admin.table("risk_assessments")
        .select("*")
        .eq("id", assessment_id)
        .eq("organization_id", current_user.organization_id)
        .limit(1)
        .execute()
    )

    assessment_rows = assessment_response.data or []
    assessment = assessment_rows[0] if assessment_rows else None

    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment was not found")

    items_response = (
        supabase_admin.table("risk_assessment_items")
        .select("*")
        .eq("assessment_id", assessment_id)
        .eq("organization_id", current_user.organization_id)
        .order("sort_order")
        .execute()
    )
    items = items_response.data or []

    organization_name = _organization_name(current_user.organization_id)
    pdf_payload = _build_pdf_payload(
        organization_name=organization_name,
        assessment=assessment,
        items=items,
        prepared_by_email=current_user.email,
    )

    return success_response(
        data={
            "assessment": assessment,
            "items": items,
            "pdf_payload": pdf_payload,
        },
        meta={},
    )
