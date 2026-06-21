from fastapi import APIRouter

from app.api.v1.endpoints import admin, admin_analytics, ai_coach, analytics, analytics_ingest, auth, barcode, coach, demo, export, feedback, food_library, food_scan, goals, habits, import_data, meal_planner, nutrition_targets, photos, reports, share, tracking, users

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
api_router.include_router(food_scan.router)
api_router.include_router(analytics_ingest.router)
api_router.include_router(admin_analytics.router)
api_router.include_router(habits.router)
api_router.include_router(share.router)
api_router.include_router(nutrition_targets.router)
api_router.include_router(food_library.router)
api_router.include_router(barcode.router)
api_router.include_router(meal_planner.router)
