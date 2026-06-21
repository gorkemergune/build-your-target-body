from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.health_sync import HealthSyncLog
from app.models.user import User
from app.models.workout import Workout
from app.schemas.health import (
    HealthImportWorkoutRequest,
    HealthSummaryResponse,
    HealthSyncCreate,
    HealthSyncResponse,
)

router = APIRouter(prefix="/health", tags=["health"])


@router.post("/sync", response_model=HealthSyncResponse, status_code=status.HTTP_201_CREATED)
def upsert_health_sync(
    payload: HealthSyncCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upsert a daily health summary. If a record for this date exists, update it."""
    existing = (
        db.query(HealthSyncLog)
        .filter(
            HealthSyncLog.user_id == current_user.id,
            HealthSyncLog.log_date == payload.log_date,
        )
        .first()
    )

    if existing:
        existing.source = payload.source
        if payload.steps is not None:
            existing.steps = payload.steps
        if payload.distance_km is not None:
            existing.distance_km = payload.distance_km
        if payload.active_calories is not None:
            existing.active_calories = payload.active_calories
        if payload.resting_heart_rate_bpm is not None:
            existing.resting_heart_rate_bpm = payload.resting_heart_rate_bpm
        if payload.avg_heart_rate_bpm is not None:
            existing.avg_heart_rate_bpm = payload.avg_heart_rate_bpm
        if payload.max_heart_rate_bpm is not None:
            existing.max_heart_rate_bpm = payload.max_heart_rate_bpm
        existing.synced_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing

    record = HealthSyncLog(
        user_id=current_user.id,
        log_date=payload.log_date,
        source=payload.source,
        steps=payload.steps,
        distance_km=payload.distance_km,
        active_calories=payload.active_calories,
        resting_heart_rate_bpm=payload.resting_heart_rate_bpm,
        avg_heart_rate_bpm=payload.avg_heart_rate_bpm,
        max_heart_rate_bpm=payload.max_heart_rate_bpm,
        synced_at=datetime.now(timezone.utc),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/summary", response_model=HealthSummaryResponse)
def get_health_summary(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return today's health data and recent history."""
    today = date.today()

    today_record = (
        db.query(HealthSyncLog)
        .filter(
            HealthSyncLog.user_id == current_user.id,
            HealthSyncLog.log_date == today,
        )
        .first()
    )

    # Last sync across all days
    last_any = (
        db.query(HealthSyncLog)
        .filter(HealthSyncLog.user_id == current_user.id)
        .order_by(HealthSyncLog.synced_at.desc())
        .first()
    )

    history = (
        db.query(HealthSyncLog)
        .filter(HealthSyncLog.user_id == current_user.id)
        .order_by(HealthSyncLog.log_date.desc())
        .limit(days)
        .all()
    )

    return HealthSummaryResponse(
        today=today_record,
        last_sync_at=last_any.synced_at if last_any else None,
        source=last_any.source if last_any else None,
        history=history,
    )


@router.get("/history", response_model=list[HealthSyncResponse])
def get_health_history(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(HealthSyncLog)
        .filter(HealthSyncLog.user_id == current_user.id)
        .order_by(HealthSyncLog.log_date.desc())
        .limit(days)
        .all()
    )


@router.post("/import-workout", status_code=status.HTTP_201_CREATED)
def import_workout_from_health(
    payload: HealthImportWorkoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import a single workout from Apple Health / Health Connect."""
    workout = Workout(
        user_id=current_user.id,
        name=payload.name,
        workout_type=payload.workout_type,
        logged_at=datetime.fromisoformat(payload.logged_at.replace("Z", "+00:00")),
        duration_minutes=payload.duration_minutes,
        calories_burned=payload.active_calories,
        distance_km=payload.distance_km,
        avg_heart_rate=payload.avg_heart_rate_bpm,
        notes=f"Imported from {payload.source.replace('_', ' ').title()}",
    )
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return {"id": workout.id, "name": workout.name, "imported": True}


@router.delete("/sync/{log_date}", status_code=status.HTTP_204_NO_CONTENT)
def delete_health_sync(
    log_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(HealthSyncLog).filter(
        HealthSyncLog.user_id == current_user.id,
        HealthSyncLog.log_date == log_date,
    ).delete()
    db.commit()
