from fastapi import APIRouter

from app.api.v1.endpoints import admin, ai_coach, analytics, auth, coach, demo, export, feedback, goals, import_data, photos, reports, tracking, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(goals.router)
api_router.include_router(tracking.router)
api_router.include_router(analytics.router)
api_router.include_router(ai_coach.router)
api_router.include_router(reports.router)
api_router.include_router(photos.router)
api_router.include_router(feedback.router)
api_router.include_router(admin.router)
api_router.include_router(demo.router)
api_router.include_router(export.router)
api_router.include_router(import_data.router)
api_router.include_router(coach.router)
