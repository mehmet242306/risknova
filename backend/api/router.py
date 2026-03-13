from fastapi import APIRouter

from api.v1.endpoints.authz_test import router as authz_test_router
from api.v1.endpoints.health import router as health_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(authz_test_router)