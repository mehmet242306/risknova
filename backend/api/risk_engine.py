from __future__ import annotations

from typing import Any

CONTEXT_WEIGHTS: dict[str, float] = {
    "c1": 0.08,
    "c2": 0.15,
    "c3": 0.12,
    "c4": 0.12,
    "c5": 0.08,
    "c6": 0.08,
    "c7": 0.15,
    "c8": 0.10,
    "c9": 0.12,
}


def clamp(value: Any, minimum: float, maximum: float) -> float:
    numeric = float(value)
    return max(minimum, min(maximum, numeric))


def round4(value: float) -> float:
    return round(float(value), 4)


def derive_risk_level(score: float) -> str:
    if score >= 80:
        return "critical"
    if score >= 60:
        return "high"
    if score >= 40:
        return "significant"
    if score >= 20:
        return "medium"
    return "low"


def calculate_item_scores(item: dict[str, Any]) -> dict[str, Any]:
    manual_probability = int(item["manual_probability"])
    manual_severity = int(item["manual_severity"])
    manual_exposure = int(item["manual_exposure"])

    gamma = clamp(item.get("gamma", 1.0), 0.0001, 5.0)

    factor_values: dict[str, float] = {
        code: clamp(item.get(code, 0.0), 0.0, 1.0) for code in CONTEXT_WEIGHTS
    }

    p = manual_probability / 5
    s = manual_severity / 5
    e = manual_exposure / 5

    base_score = ((0.35 * p) + (0.45 * s) + (0.20 * e)) * 100
    weighted_context_score = sum(
        CONTEXT_WEIGHTS[code] * factor_values[code] for code in CONTEXT_WEIGHTS
    )
    raw_score = base_score * (1 + weighted_context_score)
    normalized_score = min(100.0, raw_score * gamma)
    risk_level = derive_risk_level(normalized_score)

    dominant_factors = [
        {
            "code": code,
            "value": round4(value),
            "weight": CONTEXT_WEIGHTS[code],
        }
        for code, value in sorted(
            factor_values.items(),
            key=lambda pair: pair[1],
            reverse=True,
        )
        if value > 0
    ][:3]

    result = {
        "gamma": round4(gamma),
        "weighted_context_score": round4(weighted_context_score),
        "raw_score": round4(raw_score),
        "normalized_score": round4(normalized_score),
        "risk_level": risk_level,
        "dominant_factors": dominant_factors,
    }

    for code, value in factor_values.items():
        result[code] = round4(value)

    return result


def summarize_assessment_results(item_results: list[dict[str, Any]]) -> dict[str, Any]:
    if not item_results:
        return {
            "item_count": 0,
            "overall_score": 0.0,
            "overall_risk_level": "low",
            "highest_item_score": 0.0,
            "highest_risk_level": "low",
        }

    highest_item = max(item_results, key=lambda item: float(item["normalized_score"]))
    highest_score = round4(float(highest_item["normalized_score"]))
    highest_risk_level = str(highest_item["risk_level"])

    return {
        "item_count": len(item_results),
        "overall_score": highest_score,
        "overall_risk_level": highest_risk_level,
        "highest_item_score": highest_score,
        "highest_risk_level": highest_risk_level,
    }
