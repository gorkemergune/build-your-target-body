from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_db
from app.models.body_fat_log import BodyFatLog
from app.models.food_item import FoodItem
from app.models.measurement_log import MeasurementLog
from app.models.nutrition_log import FoodEntry, NutritionLog
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout, WorkoutExercise, WorkoutSet
from app.schemas.tracking import (
    BodyFatLogCreate,
    BodyFatLogResponse,
    FoodEntryCreate,
    FoodEntryResponse,
    MeasurementCreate,
    MeasurementResponse,
    NutritionLogCreate,
    NutritionLogResponse,
    WeightLogCreate,
    WeightLogResponse,
    WorkoutCreate,
    WorkoutResponse,
)

router = APIRouter(tags=["tracking"])


# ── Weight ────────────────────────────────────────────────────────────────────

@router.post("/weight", response_model=WeightLogResponse, status_code=status.HTTP_201_CREATED)
def log_weight(
    payload: WeightLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = WeightLog(
        user_id=current_user.id,
        weight_kg=payload.weight_kg,
        logged_at=payload.logged_at or datetime.now(timezone.utc),
        notes=payload.notes,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/weight", response_model=list[WeightLogResponse])
def list_weight(
    limit: int = 90,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(WeightLog)
        .filter(WeightLog.user_id == current_user.id)
        .order_by(WeightLog.logged_at.desc())
        .limit(limit)
        .all()
    )


@router.delete("/weight/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(WeightLog).filter(WeightLog.id == log_id, WeightLog.user_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
    db.delete(log)
    db.commit()


# ── Body Fat ──────────────────────────────────────────────────────────────────

@router.post("/body-fat", response_model=BodyFatLogResponse, status_code=status.HTTP_201_CREATED)
def log_body_fat(
    payload: BodyFatLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = BodyFatLog(
        user_id=current_user.id,
        body_fat_pct=payload.body_fat_pct,
        logged_at=payload.logged_at or datetime.now(timezone.utc),
        notes=payload.notes,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/body-fat", response_model=list[BodyFatLogResponse])
def list_body_fat(
    limit: int = 90,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(BodyFatLog)
        .filter(BodyFatLog.user_id == current_user.id)
        .order_by(BodyFatLog.logged_at.desc())
        .limit(limit)
        .all()
    )


@router.delete("/body-fat/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_body_fat(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(BodyFatLog).filter(BodyFatLog.id == log_id, BodyFatLog.user_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
    db.delete(log)
    db.commit()


# ── Measurements ──────────────────────────────────────────────────────────────

@router.post("/measurements", response_model=MeasurementResponse, status_code=status.HTTP_201_CREATED)
def log_measurement(
    payload: MeasurementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = MeasurementLog(
        user_id=current_user.id,
        logged_at=payload.logged_at or datetime.now(timezone.utc),
        **payload.model_dump(exclude={"logged_at"}),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/measurements", response_model=list[MeasurementResponse])
def list_measurements(
    limit: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(MeasurementLog)
        .filter(MeasurementLog.user_id == current_user.id)
        .order_by(MeasurementLog.logged_at.desc())
        .limit(limit)
        .all()
    )


@router.delete("/measurements/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_measurement(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(MeasurementLog).filter(MeasurementLog.id == log_id, MeasurementLog.user_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
    db.delete(log)
    db.commit()


# ── Nutrition ─────────────────────────────────────────────────────────────────

@router.get("/nutrition", response_model=list[NutritionLogResponse])
def list_nutrition_logs(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = date.today() - timedelta(days=days)
    return (
        db.query(NutritionLog)
        .filter(NutritionLog.user_id == current_user.id, NutritionLog.logged_date >= cutoff)
        .order_by(NutritionLog.logged_date.desc())
        .all()
    )


@router.post("/nutrition", response_model=NutritionLogResponse, status_code=status.HTTP_201_CREATED)
def create_nutrition_log(
    payload: NutritionLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(NutritionLog)
        .filter(NutritionLog.user_id == current_user.id, NutritionLog.logged_date == payload.logged_date)
        .first()
    )
    if existing:
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    log = NutritionLog(**payload.model_dump(), user_id=current_user.id)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/nutrition/{log_date}", response_model=NutritionLogResponse)
def get_nutrition_log(
    log_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = (
        db.query(NutritionLog)
        .filter(NutritionLog.user_id == current_user.id, NutritionLog.logged_date == log_date)
        .first()
    )
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No nutrition log for this date")
    return log


@router.delete("/nutrition/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_nutrition_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(NutritionLog).filter(NutritionLog.id == log_id, NutritionLog.user_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
    db.delete(log)
    db.commit()


@router.post("/nutrition/{log_id}/foods", response_model=FoodEntryResponse, status_code=status.HTTP_201_CREATED)
def add_food_entry(
    log_id: int,
    payload: FoodEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(NutritionLog).filter(NutritionLog.id == log_id, NutritionLog.user_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nutrition log not found")
    entry = FoodEntry(**payload.model_dump(), nutrition_log_id=log_id)
    db.add(entry)
    if payload.food_item_id:
        food_item = db.query(FoodItem).filter(
            FoodItem.id == payload.food_item_id,
            FoodItem.user_id == current_user.id,
        ).first()
        if food_item:
            food_item.use_count += 1
            food_item.last_used_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/nutrition/{log_id}/foods/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food_entry(
    log_id: int,
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(NutritionLog).filter(NutritionLog.id == log_id, NutritionLog.user_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nutrition log not found")
    entry = db.query(FoodEntry).filter(FoodEntry.id == entry_id, FoodEntry.nutrition_log_id == log_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food entry not found")
    db.delete(entry)
    db.commit()


# ── Workouts ──────────────────────────────────────────────────────────────────

def _compute_summary(exercises: list) -> tuple[float, int, int]:
    """Return (total_volume_kg, total_sets, total_reps) from workout_sets."""
    vol = 0.0
    sets = 0
    reps = 0
    for ex in exercises:
        for s in ex.workout_sets:
            if s.set_type == "working":
                sets += 1
                if s.reps:
                    reps += s.reps
                if s.reps and s.weight_kg:
                    vol += s.reps * s.weight_kg
    return round(vol, 1), sets, reps


@router.post("/workouts", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
def create_workout(
    payload: WorkoutCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workout = Workout(
        user_id=current_user.id,
        name=payload.name,
        logged_at=payload.logged_at or datetime.now(timezone.utc),
        notes=payload.notes,
        duration_minutes=payload.duration_minutes,
        workout_type=payload.workout_type,
        calories_burned=payload.calories_burned,
        distance_km=payload.distance_km,
        avg_heart_rate=payload.avg_heart_rate,
    )
    db.add(workout)
    db.flush()

    for ex_data in payload.exercises:
        ex = WorkoutExercise(
            workout_id=workout.id,
            exercise_name=ex_data.exercise_name,
            exercise_id=ex_data.exercise_id,
            order_index=ex_data.order_index,
            notes=ex_data.notes,
            sets=ex_data.sets,
            reps=ex_data.reps,
            weight_kg=ex_data.weight_kg,
            duration_seconds=ex_data.duration_seconds,
        )
        db.add(ex)
        db.flush()
        for set_data in ex_data.sets_data:
            db.add(WorkoutSet(workout_exercise_id=ex.id, **set_data.model_dump()))

    db.flush()
    # Load exercises+sets to compute summary
    db.refresh(workout)
    for ex in workout.exercises:
        db.refresh(ex)
    vol, total_sets, total_reps = _compute_summary(workout.exercises)
    workout.total_volume_kg = vol
    workout.total_sets = total_sets
    workout.total_reps = total_reps
    db.commit()
    db.refresh(workout)
    return workout


@router.get("/workouts", response_model=list[WorkoutResponse])
def list_workouts(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Workout)
        .options(joinedload(Workout.exercises).joinedload(WorkoutExercise.workout_sets))
        .filter(Workout.user_id == current_user.id)
        .order_by(Workout.logged_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/workouts/{workout_id}", response_model=WorkoutResponse)
def get_workout(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workout = (
        db.query(Workout)
        .options(joinedload(Workout.exercises).joinedload(WorkoutExercise.workout_sets))
        .filter(Workout.id == workout_id, Workout.user_id == current_user.id)
        .first()
    )
    if not workout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")
    return workout


@router.delete("/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    workout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workout = db.query(Workout).filter(Workout.id == workout_id, Workout.user_id == current_user.id).first()
    if not workout:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")
    db.delete(workout)
    db.commit()
