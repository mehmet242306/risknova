from __future__ import annotations

import json
import uuid
from typing import Any

import httpx

from config import settings

ALLOWED_HAZARD_CODES: list[str] = [
    "missing_ppe",
    "fall_hazard",
    "trip_hazard",
    "electrical_exposure",
    "unstable_stacking",
    "blocked_escape_route",
    "unsafe_ladder_use",
    "manual_handling_risk",
    "machine_guarding_issue",
    "confined_space_hazard",
    "fire_equipment_blocked",
    "vehicle_operation_hazard",
]

VISION_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "hazard_code": {
                        "type": "string",
                        "enum": ALLOWED_HAZARD_CODES,
                    },
                    "hazard_label": {"type": "string"},
                    "hazard_description": {"type": "string"},
                    "category": {"type": "string"},
                    "confidence": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1,
                    },
                    "priority_1_10": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 10,
                    },
                    "needs_human_review": {"type": "boolean"},
                    "reasoning_summary": {"type": "string"},
                    "annotations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "type": {
                                    "type": "string",
                                    "enum": ["pin", "box", "polygon"],
                                },
                                "label": {"type": "string"},
                                "x": {"type": ["number", "null"]},
                                "y": {"type": ["number", "null"]},
                                "width": {"type": ["number", "null"]},
                                "height": {"type": ["number", "null"]},
                                "points": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "additionalProperties": False,
                                        "properties": {
                                            "x": {
                                                "type": "number",
                                                "minimum": 0,
                                                "maximum": 100,
                                            },
                                            "y": {
                                                "type": "number",
                                                "minimum": 0,
                                                "maximum": 100,
                                            },
                                        },
                                        "required": ["x", "y"],
                                    },
                                },
                            },
                            "required": [
                                "type",
                                "label",
                                "x",
                                "y",
                                "width",
                                "height",
                                "points",
                            ],
                        },
                    },
                },
                "required": [
                    "hazard_code",
                    "hazard_label",
                    "hazard_description",
                    "category",
                    "confidence",
                    "priority_1_10",
                    "needs_human_review",
                    "reasoning_summary",
                    "annotations",
                ],
            },
        }
    },
    "required": ["findings"],
}


VISION_SYSTEM_PROMPT = """
You are RiskNova Vision, an occupational health and safety visual risk analysis assistant.

Your job:
1. Analyze the image only from visible evidence.
2. Identify candidate occupational safety findings.
3. Return structured findings with annotations.
4. Use only the allowed hazard codes.
5. Use normalized annotation coordinates in percentage scale 0-100.
6. Prefer conservative output: if the evidence is weak, still return a candidate finding but set needs_human_review=true.
7. Never invent hidden conditions that cannot be visually supported.
8. Do not produce more than 6 findings for one image.
9. For annotations:
   - pin: main risk point
   - box: object or local evidence region
   - polygon: area-based hazard region
10. Every finding must contain at least one annotation.
""".strip()


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _extract_response_text(response_json: dict[str, Any]) -> str:
    output_items = response_json.get("output") or []
    for item in output_items:
        if item.get("type") != "message":
            continue

        for content in item.get("content") or []:
            if content.get("type") == "output_text":
                return content.get("text", "")
            if content.get("type") == "refusal":
                raise RuntimeError("OpenAI request was refused")

    output_text = response_json.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    raise RuntimeError("Could not extract structured text from OpenAI response")


def _normalize_annotation(annotation: dict[str, Any]) -> dict[str, Any]:
    annotation_type = str(annotation.get("type", "pin")).strip().lower()
    if annotation_type not in {"pin", "box", "polygon"}:
        annotation_type = "pin"

    normalized: dict[str, Any] = {
        "annotation_id": str(uuid.uuid4()),
        "type": annotation_type,
        "label": str(annotation.get("label") or "Risk"),
        "x": None,
        "y": None,
        "width": None,
        "height": None,
        "points": [],
    }

    if annotation_type in {"pin", "box"}:
        normalized["x"] = round(_clamp(_as_float(annotation.get("x")), 0, 100), 2)
        normalized["y"] = round(_clamp(_as_float(annotation.get("y")), 0, 100), 2)

    if annotation_type == "box":
        normalized["width"] = round(
            _clamp(_as_float(annotation.get("width"), 10.0), 1, 100), 2
        )
        normalized["height"] = round(
            _clamp(_as_float(annotation.get("height"), 10.0), 1, 100), 2
        )

    if annotation_type == "polygon":
        points = []
        for point in annotation.get("points") or []:
            points.append(
                {
                    "x": round(_clamp(_as_float(point.get("x")), 0, 100), 2),
                    "y": round(_clamp(_as_float(point.get("y")), 0, 100), 2),
                }
            )
        if not points:
            points = [
                {"x": 20.0, "y": 20.0},
                {"x": 60.0, "y": 20.0},
                {"x": 60.0, "y": 60.0},
                {"x": 20.0, "y": 60.0},
            ]
        normalized["points"] = points

    return normalized


def _normalize_finding(finding: dict[str, Any], image_id: str) -> dict[str, Any]:
    hazard_code = str(finding.get("hazard_code") or "missing_ppe").strip()
    if hazard_code not in ALLOWED_HAZARD_CODES:
        hazard_code = "missing_ppe"

    annotations_raw = finding.get("annotations") or []
    normalized_annotations = [
        _normalize_annotation(annotation)
        for annotation in annotations_raw
        if isinstance(annotation, dict)
    ]

    if not normalized_annotations:
        normalized_annotations = [
            {
                "annotation_id": str(uuid.uuid4()),
                "type": "pin",
                "label": "Risk",
                "x": 50.0,
                "y": 50.0,
                "width": None,
                "height": None,
                "points": [],
            }
        ]

    return {
        "finding_id": str(uuid.uuid4()),
        "image_id": image_id,
        "hazard_code": hazard_code,
        "hazard_label": str(finding.get("hazard_label") or hazard_code),
        "hazard_description": str(finding.get("hazard_description") or ""),
        "category": str(finding.get("category") or "general"),
        "confidence": round(_clamp(_as_float(finding.get("confidence"), 0.5), 0, 1), 4),
        "priority_1_10": int(_clamp(_as_float(finding.get("priority_1_10"), 5), 1, 10)),
        "needs_human_review": bool(finding.get("needs_human_review", True)),
        "reasoning_summary": str(finding.get("reasoning_summary") or ""),
        "annotations": normalized_annotations,
    }


class OpenAIVisionClient:
    def __init__(self) -> None:
        self.api_key = settings.openai_api_key
        self.model = settings.openai_vision_model
        self.detail = settings.openai_vision_detail
        self.timeout_seconds = settings.openai_timeout_seconds

    @property
    def is_enabled(self) -> bool:
        return bool(self.api_key)

    async def detect_findings_for_image(
        self,
        *,
        analysis_title: str | None,
        method: str,
        line_title: str | None,
        line_description: str | None,
        image_id: str,
        file_name: str | None,
        mime_type: str | None,
        data_url: str,
    ) -> list[dict[str, Any]]:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")

        if not data_url.startswith("data:image/"):
            raise RuntimeError(
                "Only data URL based image inputs are supported in this MVP"
            )

        developer_prompt = f"""
Analysis title: {analysis_title or "-"}
Scoring method selected by user: {method}
Line title: {line_title or "-"}
Line description: {line_description or "-"}
Image id: {image_id}
File name: {file_name or "-"}
Mime type: {mime_type or "-"}
Allowed hazard codes: {", ".join(ALLOWED_HAZARD_CODES)}

Return only findings supported by visible evidence in the image.
Use Turkish for hazard_label, hazard_description, and reasoning_summary.
Keep hazard_code in English snake_case from the allowed catalog.
""".strip()

        payload = {
            "model": self.model,
            "store": False,
            "input": [
                {
                    "role": "developer",
                    "content": [
                        {
                            "type": "input_text",
                            "text": VISION_SYSTEM_PROMPT,
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": developer_prompt,
                        },
                        {
                            "type": "input_image",
                            "image_url": data_url,
                            "detail": self.detail,
                        },
                    ],
                },
            ],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "risknova_visual_findings",
                    "strict": True,
                    "schema": VISION_RESPONSE_SCHEMA,
                }
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if response.status_code >= 400:
            raise RuntimeError(
                f"OpenAI request failed with status {response.status_code}: {response.text}"
            )

        response_json = response.json()
        raw_text = _extract_response_text(response_json)
        parsed = json.loads(raw_text)
        findings = parsed.get("findings") or []

        normalized_findings = [
            _normalize_finding(finding, image_id=image_id)
            for finding in findings
            if isinstance(finding, dict)
        ]

        return normalized_findings


openai_vision_client = OpenAIVisionClient()
