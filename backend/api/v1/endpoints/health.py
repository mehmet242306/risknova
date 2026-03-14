from fastapi import APIRouter

from api.responses import success_response
from config import settings

router = APIRouter()


@router.get("/health", tags=["health"])
async def health_check():
    return success_response(
        data={
            "status": "ok",
            "service": settings.app_name,
            "version": settings.app_version,
        },
        meta={},
    )