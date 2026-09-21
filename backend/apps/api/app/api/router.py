"""Main API Router aggregating endpoint modules."""
from fastapi import APIRouter
from app.api.endpoints import health, cases, observations, resolutions

api_router = APIRouter()

# Include endpoints
api_router.include_router(health.router)
api_router.include_router(cases.router)
api_router.include_router(observations.router)
api_router.include_router(resolutions.router)
