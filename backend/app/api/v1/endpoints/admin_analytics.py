"""Admin-only analytics endpoints for the /admin/analytics dashboard."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, distinct, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.error_log import ErrorLog
from app.models.feedback import Feedback
from app.models.goal import Goal
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.models.weight_log import WeightLog

router = APIRouter(prefix="/admin", tags=["admin-analytics"])


def _require_admin(x_admin_key: str | None = Header(None)):
    if not settings.ADMIN_SECRET or x_admin_key != settings.ADMIN_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _days_ago(n: int) -> datetime:
    return _now() - timedelta(days=n)


# ──────────────────────────────────────────────────────────────────────
# Overview
# ──────────────────────────────────────────────────────────────────────

@router.get("/analytics/overview", dependencies=[Depends(_require_admin)])
def analytics_overview(db: Session = Depends(get_db)):
    total_users = db.query(func.count(User.id)).scalar() or 0

    dau = (
        db.query(func.count(distinct(UsageEvent.user_id)))
        .filter(UsageEvent.created_at >= _days_ago(1))
        .scalar() or 0
    )
    wau = (
        db.query(func.count(distinct(UsageEvent.user_id)))
        .filter(UsageEvent.created_at >= _days_ago(7))
        .scalar() or 0
    )
    mau = (
        db.query(func.count(distinct(UsageEvent.user_id)))
        .filter(UsageEvent.created_at >= _days_ago(30))
        .scalar() or 0
    )

    new_7d = (
        db.query(func.count(User.id))
        .filter(User.created_at >= _days_ago(7))
        .scalar() or 0
    )
    new_30d = (
        db.query(func.count(User.id))
        .filter(User.created_at >= _days_ago(30))
        .scalar() or 0
    )

    events_7d = (
        db.query(func.count(UsageEvent.id))
        .filter(UsageEvent.created_at >= _days_ago(7))
        .scalar() or 0
    )

    ai_events_7d = (
        db.query(func.count(UsageEvent.id))
        .filter(
            UsageEvent.event_type == "feature_used",
            UsageEvent.event_name.in_(["ai_chat", "food_scan", "coach_generate", "report_generate"]),
            UsageEvent.created_at >= _days_ago(7),
        )
        .scalar() or 0
    )

    errors_24h = (
        db.query(func.count(ErrorLog.id))
        .filter(ErrorLog.created_at >= _days_ago(1))
        .scalar() or 0
    )

    return {
        "users": {
            "total": total_users,
            "new_7d": new_7d,
            "new_30d": new_30d,
            "dau": dau,
            "wau": wau,
            "mau": mau,
        },
        "events_7d": events_7d,
        "ai_usage_7d": ai_events_7d,
        "errors_24h": errors_24h,
    }


# ──────────────────────────────────────────────────────────────────────
# Feature usage
# ──────────────────────────────────────────────────────────────────────

@router.get("/analytics/features", dependencies=[Depends(_require_admin)])
def analytics_features(days: int = 30, db: Session = Depends(get_db)):
    since = _days_ago(days)

    rows = (
        db.query(UsageEvent.event_name, func.count(UsageEvent.id).label("count"))
        .filter(
            UsageEvent.event_type == "feature_used",
            UsageEvent.event_name.isnot(None),
            UsageEvent.created_at >= since,
        )
        .group_by(UsageEvent.event_name)
        .order_by(func.count(UsageEvent.id).desc())
        .all()
    )

    page_rows = (
        db.query(UsageEvent.event_name, func.count(UsageEvent.id).label("count"))
        .filter(
            UsageEvent.event_type == "page_view",
            UsageEvent.event_name.isnot(None),
            UsageEvent.created_at >= since,
        )
        .group_by(UsageEvent.event_name)
        .order_by(func.count(UsageEvent.id).desc())
        .limit(10)
        .all()
    )

    unique_users = (
        db.query(UsageEvent.event_name, func.count(distinct(UsageEvent.user_id)).label("unique"))
        .filter(
            UsageEvent.event_type == "feature_used",
            UsageEvent.event_name.isnot(None),
            UsageEvent.created_at >= since,
        )
        .group_by(UsageEvent.event_name)
        .all()
    )
    unique_map = {r[0]: r[1] for r in unique_users}

    return {
        "days": days,
        "features": [
            {"name": r[0], "count": r[1], "unique_users": unique_map.get(r[0], 0)}
            for r in rows
        ],
        "top_pages": [{"page": r[0], "views": r[1]} for r in page_rows],
    }


# ──────────────────────────────────────────────────────────────────────
# Retention D1 / D7 / D30
# ──────────────────────────────────────────────────────────────────────

@router.get("/analytics/retention", dependencies=[Depends(_require_admin)])
def analytics_retention(db: Session = Depends(get_db)):
    def _retained(min_days_since_reg: int, window_start: int, window_end: int) -> dict:
        cutoff = _now() - timedelta(days=min_days_since_reg)
        eligible = (
            db.query(User.id, User.created_at)
            .filter(User.created_at <= cutoff)
            .all()
        )
        if not eligible:
            return {"eligible": 0, "retained": 0, "rate": 0.0}

        retained = 0
        for user_id, reg_date in eligible:
            reg = reg_date if reg_date.tzinfo else reg_date.replace(tzinfo=timezone.utc)
            lo = reg + timedelta(days=window_start)
            hi = reg + timedelta(days=window_end)
            count = (
                db.query(func.count(UsageEvent.id))
                .filter(
                    UsageEvent.user_id == user_id,
                    UsageEvent.created_at >= lo,
                    UsageEvent.created_at < hi,
                )
                .scalar() or 0
            )
            if count > 0:
                retained += 1

        return {
            "eligible": len(eligible),
            "retained": retained,
            "rate": round(retained / len(eligible) * 100, 1) if eligible else 0.0,
        }

    return {
        "d1": _retained(1, 1, 2),
        "d7": _retained(7, 6, 8),
        "d30": _retained(30, 28, 32),
    }


# ──────────────────────────────────────────────────────────────────────
# User journey funnel
# ──────────────────────────────────────────────────────────────────────

@router.get("/analytics/funnel", dependencies=[Depends(_require_admin)])
def analytics_funnel(db: Session = Depends(get_db)):
    registered = db.query(func.count(User.id)).scalar() or 0
    created_goal = db.query(func.count(distinct(Goal.user_id))).scalar() or 0
    first_weight = db.query(func.count(distinct(WeightLog.user_id))).scalar() or 0

    # Second visit: users with events on >= 2 distinct calendar days
    second_visit = (
        db.query(func.count())
        .select_from(
            db.query(
                UsageEvent.user_id,
                func.count(distinct(func.date(UsageEvent.created_at))).label("days"),
            )
            .filter(UsageEvent.user_id.isnot(None))
            .group_by(UsageEvent.user_id)
            .having(func.count(distinct(func.date(UsageEvent.created_at))) >= 2)
            .subquery()
        )
        .scalar() or 0
    )

    def _pct(n: int, total: int) -> float:
        return round(n / total * 100, 1) if total else 0.0

    steps = [
        {"step": "registered", "count": registered, "pct": 100.0},
        {"step": "created_goal", "count": created_goal, "pct": _pct(created_goal, registered)},
        {"step": "first_weight_log", "count": first_weight, "pct": _pct(first_weight, registered)},
        {"step": "second_visit", "count": second_visit, "pct": _pct(second_visit, registered)},
    ]

    # Find the biggest drop-off
    drop_off_step = None
    max_drop = 0.0
    for i in range(1, len(steps)):
        prev = steps[i - 1]["pct"]
        curr = steps[i]["pct"]
        drop = prev - curr
        if drop > max_drop:
            max_drop = drop
            drop_off_step = steps[i]["step"]

    return {"steps": steps, "biggest_drop_off": drop_off_step}


# ──────────────────────────────────────────────────────────────────────
# Feedback correlation
# ──────────────────────────────────────────────────────────────────────

_FEATURE_KEYWORDS = {
    "weight_log": ["weight", "kilo", "ağırlık"],
    "workout_log": ["workout", "antrenman", "egzersiz", "exercise"],
    "nutrition_log": ["nutrition", "calorie", "kalori", "besin", "yemek", "food"],
    "photo_upload": ["photo", "fotoğraf", "picture", "resim"],
    "food_scan": ["scan", "tara", "kamera", "camera"],
    "ai_chat": ["ai", "coach", "koç", "chat"],
    "report_generate": ["report", "rapor", "analysis", "analiz"],
    "export": ["export", "dışa aktar", "backup", "yedek"],
}


@router.get("/analytics/feedback-correlation", dependencies=[Depends(_require_admin)])
def analytics_feedback_correlation(days: int = 30, db: Session = Depends(get_db)):
    since = _days_ago(days)
    feedbacks = db.query(Feedback).filter(Feedback.created_at >= since).all()

    feature_mentions: dict[str, int] = {f: 0 for f in _FEATURE_KEYWORDS}
    for fb in feedbacks:
        msg_lower = (fb.message or "").lower()
        for feature, keywords in _FEATURE_KEYWORDS.items():
            if any(kw in msg_lower for kw in keywords):
                feature_mentions[feature] += 1

    # Feature usage in same window
    usage_rows = (
        db.query(UsageEvent.event_name, func.count(UsageEvent.id))
        .filter(
            UsageEvent.event_type == "feature_used",
            UsageEvent.created_at >= since,
        )
        .group_by(UsageEvent.event_name)
        .all()
    )
    usage_map = {r[0]: r[1] for r in usage_rows}

    correlations = []
    for feature, mentions in feature_mentions.items():
        usage = usage_map.get(feature, 0)
        correlations.append({
            "feature": feature,
            "feedback_mentions": mentions,
            "actual_usage": usage,
            "requested_but_ignored": mentions > 2 and usage == 0,
        })

    correlations.sort(key=lambda x: x["feedback_mentions"], reverse=True)

    return {
        "total_feedback": len(feedbacks),
        "correlations": correlations,
    }


# ──────────────────────────────────────────────────────────────────────
# Error logs
# ──────────────────────────────────────────────────────────────────────

@router.get("/analytics/errors", dependencies=[Depends(_require_admin)])
def analytics_errors(days: int = 7, db: Session = Depends(get_db)):
    since = _days_ago(days)

    recent = (
        db.query(ErrorLog)
        .filter(ErrorLog.created_at >= since)
        .order_by(ErrorLog.created_at.desc())
        .limit(50)
        .all()
    )

    by_type = (
        db.query(ErrorLog.error_type, func.count(ErrorLog.id))
        .filter(ErrorLog.created_at >= since)
        .group_by(ErrorLog.error_type)
        .all()
    )

    by_endpoint = (
        db.query(ErrorLog.endpoint, func.count(ErrorLog.id))
        .filter(ErrorLog.created_at >= since, ErrorLog.endpoint.isnot(None))
        .group_by(ErrorLog.endpoint)
        .order_by(func.count(ErrorLog.id).desc())
        .limit(10)
        .all()
    )

    return {
        "days": days,
        "total": len(recent),
        "by_type": {r[0]: r[1] for r in by_type},
        "top_failing_endpoints": [{"endpoint": r[0], "count": r[1]} for r in by_endpoint],
        "recent": [
            {
                "id": e.id,
                "error_type": e.error_type,
                "message": e.message[:200],
                "endpoint": e.endpoint,
                "status_code": e.status_code,
                "created_at": e.created_at.isoformat(),
            }
            for e in recent
        ],
    }


# ──────────────────────────────────────────────────────────────────────
# Weekly summary (product insights)
# ──────────────────────────────────────────────────────────────────────

@router.get("/analytics/weekly-summary", dependencies=[Depends(_require_admin)])
def analytics_weekly_summary(db: Session = Depends(get_db)):
    since = _days_ago(7)

    active_users = (
        db.query(func.count(distinct(UsageEvent.user_id)))
        .filter(UsageEvent.created_at >= since, UsageEvent.user_id.isnot(None))
        .scalar() or 0
    )

    total_events = (
        db.query(func.count(UsageEvent.id))
        .filter(UsageEvent.created_at >= since)
        .scalar() or 0
    )

    avg_events = round(total_events / active_users, 1) if active_users else 0.0

    features_rows = (
        db.query(UsageEvent.event_name, func.count(UsageEvent.id).label("n"))
        .filter(
            UsageEvent.event_type == "feature_used",
            UsageEvent.event_name.isnot(None),
            UsageEvent.created_at >= since,
        )
        .group_by(UsageEvent.event_name)
        .order_by(func.count(UsageEvent.id).desc())
        .all()
    )

    top_features = [{"name": r[0], "count": r[1]} for r in features_rows[:3]]
    least_features = [{"name": r[0], "count": r[1]} for r in features_rows[-3:]] if len(features_rows) > 3 else []

    # Funnel drop-off (reuse funnel logic inline)
    registered = db.query(func.count(User.id)).scalar() or 0
    created_goal = db.query(func.count(distinct(Goal.user_id))).scalar() or 0
    first_weight = db.query(func.count(distinct(WeightLog.user_id))).scalar() or 0

    funnel = [
        ("registered → goal", registered, created_goal),
        ("goal → weight_log", created_goal, first_weight),
    ]
    biggest_drop = max(funnel, key=lambda x: (x[1] - x[2]) / max(x[1], 1))

    new_users_7d = (
        db.query(func.count(User.id))
        .filter(User.created_at >= since)
        .scalar() or 0
    )

    errors_7d = (
        db.query(func.count(ErrorLog.id))
        .filter(ErrorLog.created_at >= since)
        .scalar() or 0
    )

    return {
        "period": "last_7_days",
        "active_users": active_users,
        "new_users": new_users_7d,
        "total_events": total_events,
        "avg_events_per_user": avg_events,
        "top_features": top_features,
        "least_used_features": least_features,
        "biggest_drop_off": biggest_drop[0],
        "errors": errors_7d,
    }
