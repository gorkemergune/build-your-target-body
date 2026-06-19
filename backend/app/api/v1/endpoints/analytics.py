from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_db
from app.models.body_fat_log import BodyFatLog
from app.models.goal import Goal
from app.models.measurement_log import MeasurementLog
from app.models.nutrition_log import NutritionLog
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
def dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    latest_weight = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == current_user.id)
        .order_by(WeightLog.logged_at.desc())
        .first()
    )
    latest_fat = (
        db.query(BodyFatLog)
        .filter(BodyFatLog.user_id == current_user.id)
        .order_by(BodyFatLog.logged_at.desc())
        .first()
    )
    active_goal = db.query(Goal).filter(Goal.user_id == current_user.id, Goal.is_active == True).first()  # noqa: E712
    todays_nutrition = (
        db.query(NutritionLog)
        .filter(NutritionLog.user_id == current_user.id, NutritionLog.logged_date == today)
        .first()
    )
    recent_workouts = (
        db.query(Workout)
        .filter(Workout.user_id == current_user.id)
        .order_by(Workout.logged_at.desc())
        .limit(5)
        .all()
    )
    latest_measurement = (
        db.query(MeasurementLog)
        .filter(MeasurementLog.user_id == current_user.id)
        .order_by(MeasurementLog.logged_at.desc())
        .first()
    )
    workouts_this_week = (
        db.query(Workout)
        .filter(Workout.user_id == current_user.id, Workout.logged_at >= week_start)
        .count()
    )

    # Consistency score: % of last 14 days with any activity
    cutoff_14 = today - timedelta(days=14)
    active_dates: set[date] = set()
    for (d,) in db.query(WeightLog.logged_at).filter(WeightLog.user_id == current_user.id, WeightLog.logged_at >= cutoff_14).all():
        active_dates.add(d.date() if hasattr(d, "date") else d)
    for (d,) in db.query(NutritionLog.logged_date).filter(NutritionLog.user_id == current_user.id, NutritionLog.logged_date >= cutoff_14).all():
        active_dates.add(d)
    for (d,) in db.query(Workout.logged_at).filter(Workout.user_id == current_user.id, Workout.logged_at >= cutoff_14).all():
        active_dates.add(d.date() if hasattr(d, "date") else d)
    consistency_score = min(100, round((len(active_dates) / 14) * 100))

    days_remaining = None
    progress_pct = None
    if active_goal and active_goal.target_date:
        days_remaining = max(0, (active_goal.target_date.date() - today).days)
        if active_goal.start_weight_kg and active_goal.target_weight_kg and latest_weight:
            total_needed = active_goal.target_weight_kg - active_goal.start_weight_kg
            current_change = latest_weight.weight_kg - active_goal.start_weight_kg
            if total_needed != 0:
                progress_pct = round(min(100, max(0, (current_change / total_needed) * 100)), 1)

    return {
        "latest_weight_kg": latest_weight.weight_kg if latest_weight else None,
        "latest_body_fat_pct": latest_fat.body_fat_pct if latest_fat else None,
        "active_goal": {
            "goal_type": active_goal.goal_type,
            "target_weight_kg": active_goal.target_weight_kg,
            "target_date": active_goal.target_date,
            "days_remaining": days_remaining,
            "progress_pct": progress_pct,
        } if active_goal else None,
        "todays_calories": todays_nutrition.total_calories if todays_nutrition else None,
        "todays_protein_g": todays_nutrition.protein_g if todays_nutrition else None,
        "recent_workouts": [
            {"id": w.id, "name": w.name, "logged_at": w.logged_at, "duration_minutes": w.duration_minutes}
            for w in recent_workouts
        ],
        "latest_measurement": {
            "chest_cm": latest_measurement.chest_cm,
            "waist_cm": latest_measurement.waist_cm,
            "hips_cm": latest_measurement.hips_cm,
            "left_arm_cm": latest_measurement.left_arm_cm,
        } if latest_measurement else None,
        "workouts_this_week": workouts_this_week,
        "consistency_score": consistency_score,
    }


@router.get("/goal-progress")
def goal_progress(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()

    active_goal = db.query(Goal).filter(Goal.user_id == current_user.id, Goal.is_active == True).first()  # noqa: E712
    if not active_goal:
        return {"has_goal": False}

    weight_logs = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == current_user.id)
        .order_by(WeightLog.logged_at.asc())
        .all()
    )

    if not weight_logs:
        return {
            "has_goal": True,
            "has_data": False,
            "goal_type": active_goal.goal_type,
            "target_weight_kg": active_goal.target_weight_kg,
            "target_date": active_goal.target_date,
            "days_remaining": max(0, (active_goal.target_date.date() - today).days) if active_goal.target_date else None,
        }

    first_log = weight_logs[0]
    latest_log = weight_logs[-1]

    start_weight = active_goal.start_weight_kg or first_log.weight_kg
    total_change_kg = round(latest_log.weight_kg - start_weight, 2)

    progress_pct = None
    if active_goal.target_weight_kg and start_weight:
        total_needed = active_goal.target_weight_kg - start_weight
        if total_needed != 0:
            progress_pct = round(min(100, max(0, (total_change_kg / total_needed) * 100)), 1)

    days_of_data = max(1, (latest_log.logged_at - first_log.logged_at).days)
    weeks_of_data = days_of_data / 7
    avg_weekly_change_kg = round(total_change_kg / weeks_of_data, 2) if weeks_of_data >= 1 else None

    estimated_completion_date = None
    if avg_weekly_change_kg and avg_weekly_change_kg != 0 and active_goal.target_weight_kg:
        remaining = active_goal.target_weight_kg - latest_log.weight_kg
        weeks_to_complete = remaining / avg_weekly_change_kg
        if weeks_to_complete > 0:
            eta = today + timedelta(weeks=weeks_to_complete)
            estimated_completion_date = eta.isoformat()

    days_remaining = None
    if active_goal.target_date:
        days_remaining = max(0, (active_goal.target_date.date() - today).days)

    return {
        "has_goal": True,
        "has_data": True,
        "goal_type": active_goal.goal_type,
        "start_weight_kg": round(start_weight, 2),
        "target_weight_kg": active_goal.target_weight_kg,
        "target_body_fat_pct": active_goal.target_body_fat_pct,
        "target_date": active_goal.target_date,
        "latest_weight_kg": latest_log.weight_kg,
        "total_change_kg": total_change_kg,
        "progress_pct": progress_pct,
        "days_remaining": days_remaining,
        "avg_weekly_change_kg": avg_weekly_change_kg,
        "estimated_completion_date": estimated_completion_date,
        "log_count": len(weight_logs),
        "first_log_date": first_log.logged_at.date().isoformat(),
        "latest_log_date": latest_log.logged_at.date().isoformat(),
    }


@router.get("/weight-trend")
def weight_trend(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = date.today() - timedelta(days=days)
    logs = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == current_user.id, WeightLog.logged_at >= cutoff)
        .order_by(WeightLog.logged_at.asc())
        .all()
    )
    return [{"date": l.logged_at.date().isoformat(), "value": l.weight_kg} for l in logs]


@router.get("/fat-trend")
def fat_trend(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = date.today() - timedelta(days=days)
    logs = (
        db.query(BodyFatLog)
        .filter(BodyFatLog.user_id == current_user.id, BodyFatLog.logged_at >= cutoff)
        .order_by(BodyFatLog.logged_at.asc())
        .all()
    )
    return [{"date": l.logged_at.date().isoformat(), "value": l.body_fat_pct} for l in logs]


@router.get("/calorie-trend")
def calorie_trend(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = date.today() - timedelta(days=days)
    logs = (
        db.query(NutritionLog)
        .filter(
            NutritionLog.user_id == current_user.id,
            NutritionLog.logged_date >= cutoff,
            NutritionLog.total_calories.isnot(None),
        )
        .order_by(NutritionLog.logged_date.asc())
        .all()
    )
    return [{"date": l.logged_date.isoformat(), "value": l.total_calories} for l in logs]


@router.get("/protein-trend")
def protein_trend(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = date.today() - timedelta(days=days)
    logs = (
        db.query(NutritionLog)
        .filter(
            NutritionLog.user_id == current_user.id,
            NutritionLog.logged_date >= cutoff,
            NutritionLog.protein_g.isnot(None),
        )
        .order_by(NutritionLog.logged_date.asc())
        .all()
    )
    return [{"date": l.logged_date.isoformat(), "value": l.protein_g} for l in logs]


@router.get("/measurement-trend")
def measurement_trend(
    field: str = "waist_cm",
    days: int = 90,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed = {
        "chest_cm", "waist_cm", "hips_cm", "neck_cm",
        "left_arm_cm", "right_arm_cm", "left_thigh_cm", "right_thigh_cm",
    }
    if field not in allowed:
        return []
    cutoff = date.today() - timedelta(days=days)
    logs = (
        db.query(MeasurementLog)
        .filter(MeasurementLog.user_id == current_user.id, MeasurementLog.logged_at >= cutoff)
        .order_by(MeasurementLog.logged_at.asc())
        .all()
    )
    return [
        {"date": l.logged_at.date().isoformat(), "value": getattr(l, field)}
        for l in logs
        if getattr(l, field) is not None
    ]


@router.get("/workout-analytics")
def workout_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    all_workouts = (
        db.query(Workout)
        .options(joinedload(Workout.exercises))
        .filter(Workout.user_id == current_user.id)
        .all()
    )

    this_week = [w for w in all_workouts if w.logged_at.date() >= week_start]
    this_month = [w for w in all_workouts if w.logged_at.date() >= month_start]

    total_volume = 0.0
    for w in all_workouts:
        for ex in w.exercises:
            if ex.sets and ex.reps and ex.weight_kg:
                total_volume += ex.sets * ex.reps * ex.weight_kg

    durations = [w.duration_minutes for w in all_workouts if w.duration_minutes]
    avg_duration = round(sum(durations) / len(durations)) if durations else None

    return {
        "workouts_this_week": len(this_week),
        "workouts_this_month": len(this_month),
        "total_workouts": len(all_workouts),
        "total_volume_kg": round(total_volume, 1),
        "avg_duration_minutes": avg_duration,
    }


@router.get("/workout-frequency")
def workout_frequency(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = date.today() - timedelta(days=days)
    workouts = (
        db.query(Workout)
        .filter(Workout.user_id == current_user.id, Workout.logged_at >= cutoff)
        .order_by(Workout.logged_at.asc())
        .all()
    )
    counts: dict[str, int] = {}
    for w in workouts:
        d = w.logged_at.date().isoformat()
        counts[d] = counts.get(d, 0) + 1
    return [{"date": d, "value": v} for d, v in sorted(counts.items())]


@router.get("/consistency-score")
def consistency_score(
    days: int = 14,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    cutoff = today - timedelta(days=days)
    active_dates: set[date] = set()

    for (d,) in db.query(WeightLog.logged_at).filter(WeightLog.user_id == current_user.id, WeightLog.logged_at >= cutoff).all():
        active_dates.add(d.date() if hasattr(d, "date") else d)
    for (d,) in db.query(NutritionLog.logged_date).filter(NutritionLog.user_id == current_user.id, NutritionLog.logged_date >= cutoff).all():
        active_dates.add(d)
    for (d,) in db.query(Workout.logged_at).filter(Workout.user_id == current_user.id, Workout.logged_at >= cutoff).all():
        active_dates.add(d.date() if hasattr(d, "date") else d)

    score = min(100, round((len(active_dates) / days) * 100))
    return {"score": score, "active_days": len(active_dates), "period_days": days}
