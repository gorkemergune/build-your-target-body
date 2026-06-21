import asyncio
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.ai_conversation import AiConversation
from app.models.ai_report import AiReport
from app.models.feedback import Feedback
from app.models.nutrition_log import NutritionLog
from app.models.progress_photo import ProgressPhoto
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout
from app.services.gemini_client import GEMINI_MODEL

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(x_admin_key: str | None = Header(None)):
    if not settings.ADMIN_SECRET or x_admin_key != settings.ADMIN_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/gemini-test", dependencies=[Depends(_require_admin)])
async def gemini_test():
    """Live probe: verifies key, model, and a real generate_content call."""
    api_key_present = bool(settings.GEMINI_API_KEY)

    if not api_key_present:
        return {
            "api_key": False,
            "model": GEMINI_MODEL,
            "success": False,
            "latency_ms": 0,
            "error": "GEMINI_API_KEY is not configured",
        }

    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)

    t0 = time.perf_counter()
    try:
        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(None, lambda: model.generate_content("Reply with exactly: OK")),
            timeout=15.0,
        )
        latency_ms = round((time.perf_counter() - t0) * 1000)
        text = response.text.strip()
        return {
            "api_key": True,
            "model": GEMINI_MODEL,
            "success": True,
            "latency_ms": latency_ms,
            "response_preview": text[:60],
        }
    except asyncio.TimeoutError:
        latency_ms = round((time.perf_counter() - t0) * 1000)
        return {
            "api_key": True,
            "model": GEMINI_MODEL,
            "success": False,
            "latency_ms": latency_ms,
            "error": "timeout after 15s",
        }
    except Exception as exc:
        latency_ms = round((time.perf_counter() - t0) * 1000)
        return {
            "api_key": True,
            "model": GEMINI_MODEL,
            "success": False,
            "latency_ms": latency_ms,
            "error": f"{type(exc).__name__}: {str(exc)[:200]}",
        }


@router.get("/stats", dependencies=[Depends(_require_admin)])
def admin_stats(db: Session = Depends(get_db)):
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    total_users = db.query(func.count(User.id)).scalar()
    new_users_7d = db.query(func.count(User.id)).filter(User.created_at >= seven_days_ago).scalar()

    feedback_rows = db.query(Feedback.type, func.count(Feedback.id)).group_by(Feedback.type).all()
    feedback_by_type = {row[0]: row[1] for row in feedback_rows}

    def event_count(event_type: str) -> int:
        return (
            db.query(func.count(UsageEvent.id))
            .filter(UsageEvent.event_type == event_type, UsageEvent.created_at >= seven_days_ago)
            .scalar()
            or 0
        )

    return {
        "users": {"total": total_users, "last_7_days": new_users_7d},
        "weight_logs": db.query(func.count(WeightLog.id)).scalar(),
        "nutrition_logs": db.query(func.count(NutritionLog.id)).scalar(),
        "workouts": db.query(func.count(Workout.id)).scalar(),
        "ai_conversations": db.query(func.count(AiConversation.id)).scalar(),
        "ai_reports": db.query(func.count(AiReport.id)).scalar(),
        "photos": db.query(func.count(ProgressPhoto.id)).scalar(),
        "feedback": {
            "total": sum(feedback_by_type.values()),
            "by_type": feedback_by_type,
        },
        "usage_last_7_days": {
            "logins": event_count("login"),
            "ai_chats": event_count("ai_chat"),
            "reports_generated": event_count("report_generated"),
            "photos_uploaded": event_count("photo_uploaded"),
        },
    }
