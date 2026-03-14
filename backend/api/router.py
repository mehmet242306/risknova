from fastapi import APIRouter

from api.v1.endpoints.audit_events import router as audit_events_router
from api.v1.endpoints.authz_test import router as authz_test_router
from api.v1.endpoints.health import router as health_router
from api.v1.endpoints.organization_actions import router as organization_actions_router
from api.v1.endpoints.profile_actions import router as profile_actions_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(authz_test_router)
api_router.include_router(audit_events_router)
api_router.include_router(profile_actions_router)
api_router.include_router(organization_actions_router)