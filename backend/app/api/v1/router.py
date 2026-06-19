from fastapi import APIRouter

from app.api.v1.endpoints import ai_coach, analytics, auth, goals, tracking, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(goals.router)
api_router.include_router(tracking.router)
api_router.include_router(analytics.router)
api_router.include_router(ai_coach.router)
