from fastapi import APIRouter
from config import settings

router = APIRouter()


@router.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version
    }
