from typing import Any


def success_response(
    data: Any = None, meta: dict[str, Any] | None = None
) -> dict[str, Any]:
    return {
        "data": data,
        "meta": meta or {},
    }


def error_response(code: str, message: str) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
        }
    }
