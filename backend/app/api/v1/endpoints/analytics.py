from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import func

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.deps import get_current_user, get_db
from app.models.body_fat_log import BodyFatLog
from app.models.goal import Goal
from app.models.measurement_log import MeasurementLog
from app.models.nutrition_log import NutritionLog
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout, WorkoutExercise, WorkoutSet


def _least_squares(points: list[tuple[float, float]]) -> tuple[Optional[float], Optional[float]]:
    n = len(points)
    if n < 2:
        return None, None
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((xs[i] - mx) * (ys[i] - my) for i in range(n))
    den = sum((xs[i] - mx) ** 2 for i in range(n))
    if den == 0:
        return 0.0, my
    slope = num / den
    return slope, my - slope * mx

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
    total_sets = 0
    total_reps = 0
    for w in all_workouts:
        if w.total_volume_kg:
            total_volume += w.total_volume_kg
        elif w.exercises:
            for ex in w.exercises:
                if ex.sets and ex.reps and ex.weight_kg:
                    total_volume += ex.sets * ex.reps * ex.weight_kg
        if w.total_sets:
            total_sets += w.total_sets
        if w.total_reps:
            total_reps += w.total_reps

    durations = [w.duration_minutes for w in all_workouts if w.duration_minutes]
    avg_duration = round(sum(durations) / len(durations)) if durations else None

    type_counts: dict[str, int] = {}
    for w in all_workouts:
        t = w.workout_type or "strength"
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        "workouts_this_week": len(this_week),
        "workouts_this_month": len(this_month),
        "total_workouts": len(all_workouts),
        "total_volume_kg": round(total_volume, 1),
        "total_sets": total_sets,
        "total_reps": total_reps,
        "avg_duration_minutes": avg_duration,
        "type_breakdown": type_counts,
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


@router.get("/intelligence")
def intelligence(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    cutoff_7 = today - timedelta(days=7)
    cutoff_14 = today - timedelta(days=14)
    cutoff_21 = today - timedelta(days=21)
    cutoff_30 = today - timedelta(days=30)
    cutoff_60 = today - timedelta(days=60)

    all_weight = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == current_user.id)
        .order_by(WeightLog.logged_at.asc())
        .all()
    )
    all_fat = (
        db.query(BodyFatLog)
        .filter(BodyFatLog.user_id == current_user.id)
        .order_by(BodyFatLog.logged_at.asc())
        .all()
    )
    active_goal = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id, Goal.is_active == True)  # noqa: E712
        .first()
    )

    # ── TRENDS ──────────────────────────────────────────────────────────────
    def _avg(vals: list[float]) -> Optional[float]:
        return sum(vals) / len(vals) if vals else None

    w_last7 = [w.weight_kg for w in all_weight if w.logged_at.date() >= cutoff_7]
    w_prev7 = [w.weight_kg for w in all_weight if cutoff_14 <= w.logged_at.date() < cutoff_7]
    w_last30 = [w.weight_kg for w in all_weight if w.logged_at.date() >= cutoff_30]
    w_prev30 = [w.weight_kg for w in all_weight if cutoff_60 <= w.logged_at.date() < cutoff_30]

    weekly_weight_change: Optional[float] = None
    if w_last7 and w_prev7:
        weekly_weight_change = round(_avg(w_last7) - _avg(w_prev7), 2)  # type: ignore[arg-type]

    monthly_weight_change: Optional[float] = None
    if w_last30 and w_prev30:
        monthly_weight_change = round(_avg(w_last30) - _avg(w_prev30), 2)  # type: ignore[arg-type]

    f_last30 = [f.body_fat_pct for f in all_fat if f.logged_at.date() >= cutoff_30]
    f_prev30 = [f.body_fat_pct for f in all_fat if cutoff_60 <= f.logged_at.date() < cutoff_30]
    monthly_fat_change: Optional[float] = None
    if f_last30 and f_prev30:
        monthly_fat_change = round(_avg(f_last30) - _avg(f_prev30), 2)  # type: ignore[arg-type]

    # ── PLATEAU DETECTION ────────────────────────────────────────────────────
    p14 = [w.weight_kg for w in all_weight if w.logged_at.date() >= cutoff_14]
    p21 = [w.weight_kg for w in all_weight if w.logged_at.date() >= cutoff_21]

    plateau_detected = False
    plateau_severity: Optional[str] = None
    plateau_days: Optional[int] = None
    plateau_range: Optional[float] = None

    if len(p14) >= 3:
        r = round(max(p14) - min(p14), 2)
        if r < 0.5:
            plateau_detected, plateau_severity, plateau_days, plateau_range = True, "major", 14, r
    if not plateau_detected and len(p21) >= 3:
        r = round(max(p21) - min(p21), 2)
        if r < 1.0:
            plateau_detected, plateau_severity, plateau_days, plateau_range = True, "minor", 21, r

    # ── HEALTH SCORE (4 × 25) ───────────────────────────────────────────────
    weight_log_days = {w.logged_at.date() for w in all_weight if w.logged_at.date() >= cutoff_14}
    weight_consistency = min(25, round(len(weight_log_days) / 14 * 25))

    nutrition_days = {
        d
        for (d,) in db.query(NutritionLog.logged_date)
        .filter(NutritionLog.user_id == current_user.id, NutritionLog.logged_date >= cutoff_14)
        .all()
    }
    nutrition_consistency = min(25, round(len(nutrition_days) / 14 * 25))

    workout_days_14: set[date] = set()
    for (d,) in db.query(Workout.logged_at).filter(
        Workout.user_id == current_user.id, Workout.logged_at >= cutoff_14
    ).all():
        workout_days_14.add(d.date() if hasattr(d, "date") else d)
    # Target: 3/week → 6 sessions in 14 days
    workout_consistency = min(25, round(len(workout_days_14) / 6 * 25))

    # ── FORECAST ────────────────────────────────────────────────────────────
    progress_pct_val: Optional[float] = None
    eta_date: Optional[str] = None
    days_ahead: Optional[int] = None
    required_weekly_change: Optional[float] = None
    goal_progress_score = 0

    if active_goal and all_weight:
        latest_w = all_weight[-1].weight_kg
        start_w = active_goal.start_weight_kg or all_weight[0].weight_kg

        if active_goal.target_weight_kg and start_w and (active_goal.target_weight_kg - start_w) != 0:
            total_needed = active_goal.target_weight_kg - start_w
            current_change = latest_w - start_w
            progress_pct_val = round(min(100, max(0, (current_change / total_needed) * 100)), 1)
            goal_progress_score = min(25, round(progress_pct_val / 100 * 25))

            remaining = active_goal.target_weight_kg - latest_w

            # ETA via current weekly rate
            if weekly_weight_change and weekly_weight_change != 0:
                weeks_needed = remaining / weekly_weight_change
                if weeks_needed > 0:
                    eta_date = (today + timedelta(weeks=weeks_needed)).isoformat()

            # Days ahead/behind vs target_date
            if eta_date and active_goal.target_date:
                target_d = active_goal.target_date.date()
                eta_d = date.fromisoformat(eta_date)
                days_ahead = (target_d - eta_d).days  # positive = ahead

            # Required weekly change to hit target on time
            if active_goal.target_date:
                days_left = (active_goal.target_date.date() - today).days
                if days_left > 0:
                    required_weekly_change = round(remaining / (days_left / 7), 2)

    total_health_score = weight_consistency + nutrition_consistency + workout_consistency + goal_progress_score

    # ── SMART INSIGHTS ───────────────────────────────────────────────────────
    insights: list[str] = []
    if not all_weight:
        insights.append("insight_no_data")
    else:
        if plateau_detected:
            insights.append("insight_plateau_detected")

        if progress_pct_val is not None:
            if progress_pct_val >= 100:
                insights.append("insight_goal_reached")
            elif progress_pct_val >= 75:
                insights.append("insight_close_to_goal")

        if days_ahead is not None:
            if days_ahead >= 7:
                insights.append("insight_ahead_schedule")
            elif days_ahead <= -7:
                insights.append("insight_behind_schedule")
            else:
                insights.append("insight_on_track")

        if total_health_score >= 75:
            insights.append("insight_excellent_consistency")
        elif total_health_score >= 50:
            insights.append("insight_good_consistency")
        elif total_health_score < 30:
            insights.append("insight_poor_consistency")

    return {
        "forecast": {
            "progress_pct": progress_pct_val,
            "eta_date": eta_date,
            "days_ahead": days_ahead,
            "required_weekly_change_kg": required_weekly_change,
            "weekly_change_kg": weekly_weight_change,
            "monthly_change_kg": monthly_weight_change,
            "monthly_fat_change_pct": monthly_fat_change,
        },
        "health_score": {
            "total": total_health_score,
            "weight_consistency": weight_consistency,
            "nutrition_consistency": nutrition_consistency,
            "workout_consistency": workout_consistency,
            "goal_progress": goal_progress_score,
        },
        "plateau": {
            "detected": plateau_detected,
            "severity": plateau_severity,
            "days_checked": plateau_days,
            "weight_range_kg": plateau_range,
        },
        "trends": {
            "weekly_weight_change_kg": weekly_weight_change,
            "monthly_weight_change_kg": monthly_weight_change,
            "monthly_fat_change_pct": monthly_fat_change,
        },
        "insights": insights,
    }


@router.get("/projection")
def weight_projection(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()

    all_weight = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == current_user.id)
        .order_by(WeightLog.logged_at.asc())
        .all()
    )
    if not all_weight:
        return []

    active_goal = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id, Goal.is_active == True)  # noqa: E712
        .first()
    )

    # Date range
    chart_start = max(all_weight[0].logged_at.date(), today - timedelta(days=90))
    if active_goal and active_goal.target_date:
        chart_end = max(active_goal.target_date.date(), today + timedelta(days=30))
    else:
        chart_end = today + timedelta(days=90)
    # Cap total range at 180 days for readability
    if (chart_end - chart_start).days > 180:
        chart_end = chart_start + timedelta(days=180)

    # Actual weights by date
    actual_by_date: dict[date, float] = {}
    for w in all_weight:
        actual_by_date[w.logged_at.date()] = w.weight_kg

    # Linear regression on last 30 days
    cutoff_30 = today - timedelta(days=30)
    reg_points = [
        (float(w.logged_at.date().toordinal()), w.weight_kg)
        for w in all_weight
        if w.logged_at.date() >= cutoff_30
    ]
    slope, intercept = _least_squares(reg_points)

    # Target path parameters
    t_start_w: Optional[float] = None
    t_end_w: Optional[float] = None
    t_start_d: Optional[date] = None
    t_end_d: Optional[date] = None

    if active_goal and active_goal.start_weight_kg and active_goal.target_weight_kg and active_goal.target_date:
        t_start_w = active_goal.start_weight_kg
        t_end_w = active_goal.target_weight_kg
        t_start_d = active_goal.created_at.date()
        t_end_d = active_goal.target_date.date()

    result = []
    cur = chart_start
    while cur <= chart_end:
        actual = actual_by_date.get(cur)

        projected: Optional[float] = None
        if slope is not None and intercept is not None and cur >= today - timedelta(days=3):
            proj = slope * cur.toordinal() + intercept
            projected = round(max(0, proj), 2)

        target: Optional[float] = None
        if t_start_d and t_end_d and t_start_w is not None and t_end_w is not None:
            total_days = (t_end_d - t_start_d).days
            if total_days > 0:
                frac = max(0.0, min(1.0, (cur - t_start_d).days / total_days))
                target = round(t_start_w + (t_end_w - t_start_w) * frac, 2)

        if actual is not None or projected is not None or target is not None:
            result.append({
                "date": cur.isoformat(),
                "actual_weight": actual,
                "projected_weight": projected,
                "target_weight": target,
            })

        cur += timedelta(days=1)

    return result


def _compute_streak(user_id: int, db: Session) -> tuple[int, int, date | None]:
    """Returns (current_streak, longest_streak, last_activity_date)."""
    active_dates: set[date] = set()
    for (d,) in db.query(WeightLog.logged_at).filter(WeightLog.user_id == user_id).all():
        active_dates.add(d.date() if hasattr(d, "date") else d)
    for (d,) in db.query(NutritionLog.logged_date).filter(NutritionLog.user_id == user_id).all():
        active_dates.add(d)
    for (d,) in db.query(Workout.logged_at).filter(Workout.user_id == user_id).all():
        active_dates.add(d.date() if hasattr(d, "date") else d)

    if not active_dates:
        return 0, 0, None

    today = date.today()
    last_activity = max(active_dates)

    current_streak = 0
    check = today
    if check not in active_dates:
        check = today - timedelta(days=1)
    while check in active_dates:
        current_streak += 1
        check -= timedelta(days=1)

    sorted_dates = sorted(active_dates)
    longest = 1
    run = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
            run += 1
            if run > longest:
                longest = run
        else:
            run = 1

    return current_streak, longest, last_activity


@router.get("/streak")
def streak(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current, longest, last = _compute_streak(current_user.id, db)
    return {
        "current_streak": current,
        "longest_streak": longest,
        "last_activity_date": last.isoformat() if last else None,
    }


@router.get("/achievements")
def achievements(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.ai_conversation import AiConversation
    from app.models.ai_report import AiReport
    from app.models.habit import HabitLog
    from app.models.progress_photo import ProgressPhoto

    weight_count = db.query(WeightLog).filter(WeightLog.user_id == current_user.id).count()
    workout_count = db.query(Workout).filter(Workout.user_id == current_user.id).count()
    photo_count = db.query(ProgressPhoto).filter(ProgressPhoto.user_id == current_user.id).count()
    report_count = db.query(AiReport).filter(AiReport.user_id == current_user.id).count()
    ai_count = db.query(AiConversation).filter(AiConversation.user_id == current_user.id).count()
    current_streak, _, _ = _compute_streak(current_user.id, db)

    # Habit achievements
    total_habit_logs = (
        db.query(func.count(HabitLog.id))
        .filter(HabitLog.user_id == current_user.id)
        .scalar() or 0
    )

    # Perfect week: 7 consecutive days with at least one habit completed
    habit_log_dates: set[date] = {
        row[0]
        for row in db.query(HabitLog.completed_date)
        .filter(HabitLog.user_id == current_user.id)
        .distinct()
        .all()
    }
    perfect_week = False
    if len(habit_log_dates) >= 7:
        today = date.today()
        consecutive = 0
        check = today
        while check in habit_log_dates:
            consecutive += 1
            if consecutive >= 7:
                perfect_week = True
                break
            check -= timedelta(days=1)

    return [
        {"id": "first_weight_log", "unlocked": weight_count >= 1},
        {"id": "first_workout", "unlocked": workout_count >= 1},
        {"id": "first_photo", "unlocked": photo_count >= 1},
        {"id": "first_report", "unlocked": report_count >= 1},
        {"id": "first_ai_chat", "unlocked": ai_count >= 1},
        {"id": "weight_logs_7", "unlocked": weight_count >= 7},
        {"id": "workouts_10", "unlocked": workout_count >= 10},
        {"id": "streak_7", "unlocked": current_streak >= 7},
        {"id": "streak_30", "unlocked": current_streak >= 30},
        {"id": "missions_7", "unlocked": total_habit_logs >= 7},
        {"id": "missions_30", "unlocked": total_habit_logs >= 30},
        {"id": "perfect_week", "unlocked": perfect_week},
    ]


# ── Workout Intelligence ───────────────────────────────────────────────────────

@router.get("/workout-intelligence")
def workout_intelligence(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _EMPTY = {
        "personal_records": [], "strength_trends": [], "plateaus": [],
        "consistency": {"total_workouts_12w": 0, "avg_workouts_per_week": 0.0},
        "volume_trend": [], "top_lifts": [], "fastest_improving": None, "strongest_lift": None,
    }

    today = date.today()
    cutoff_90d = datetime.combine(today - timedelta(days=90), datetime.min.time())

    workouts = (
        db.query(Workout)
        .options(selectinload(Workout.exercises).selectinload(WorkoutExercise.workout_sets))
        .filter(Workout.user_id == current_user.id, Workout.logged_at >= cutoff_90d)
        .order_by(Workout.logged_at.asc())
        .all()
    )
    if not workouts:
        return _EMPTY

    # Build per-exercise session history
    exercise_history: dict[str, list[dict]] = defaultdict(list)
    for w in workouts:
        w_date = w.logged_at.date()
        for ex in w.exercises:
            working = [
                s for s in ex.workout_sets
                if s.set_type == "working" and (s.weight_kg or 0) > 0
            ]
            if not working:
                continue
            max_w = max(s.weight_kg for s in working)  # type: ignore[arg-type]
            max_r = max((s.reps or 0) for s in working)
            vol = sum((s.reps or 0) * (s.weight_kg or 0) for s in working)
            exercise_history[ex.exercise_name].append(
                {"date": w_date, "max_weight": max_w, "max_reps": max_r, "session_volume": vol}
            )

    # Personal records (all-time)
    personal_records = []
    for name, sessions in exercise_history.items():
        w_best = max(sessions, key=lambda s: s["max_weight"])
        r_best = max(sessions, key=lambda s: s["max_reps"])
        v_best = max(sessions, key=lambda s: s["session_volume"])
        personal_records.append({
            "exercise_name": name,
            "weight_pr": w_best["max_weight"],
            "weight_pr_date": str(w_best["date"]),
            "rep_pr": r_best["max_reps"],
            "rep_pr_date": str(r_best["date"]),
            "volume_pr": round(v_best["session_volume"], 1),
            "volume_pr_date": str(v_best["date"]),
            "session_count": len(sessions),
        })
    personal_records.sort(key=lambda x: x["weight_pr"], reverse=True)

    # Strength trends: last 4 weeks vs prior 4 weeks
    w4 = today - timedelta(weeks=4)
    w8 = today - timedelta(weeks=8)
    strength_trends = []
    for name, sessions in exercise_history.items():
        recent = [s for s in sessions if s["date"] >= w4]
        prior = [s for s in sessions if w8 <= s["date"] < w4]
        if len(recent) < 2 or not prior:
            continue
        r_avg = sum(s["max_weight"] for s in recent) / len(recent)
        p_avg = sum(s["max_weight"] for s in prior) / len(prior)
        if p_avg <= 0:
            continue
        strength_trends.append({
            "exercise_name": name,
            "recent_avg_weight": round(r_avg, 1),
            "previous_avg_weight": round(p_avg, 1),
            "growth_pct": round((r_avg - p_avg) / p_avg * 100, 1),
            "recent_sessions": len(recent),
        })
    strength_trends.sort(key=lambda x: x["growth_pct"], reverse=True)

    # Plateau detection: last 6 weeks, ≥ 3 sessions
    w6 = today - timedelta(weeks=6)
    plateaus = []
    for name, sessions in exercise_history.items():
        recent = sorted([s for s in sessions if s["date"] >= w6], key=lambda s: s["date"])
        if len(recent) < 3:
            continue
        weights = [s["max_weight"] for s in recent]
        last3 = weights[-3:]
        span_weeks = round((recent[-1]["date"] - recent[0]["date"]).days / 7, 1)
        is_declining = len(last3) == 3 and last3[0] > last3[1] >= last3[2]
        is_plateau = (weights[-1] - weights[0]) < 2.5 and len(recent) >= 4
        if is_declining:
            plateaus.append({
                "exercise_name": name, "status": "declining",
                "sessions_checked": len(recent), "weeks_stagnant": span_weeks,
                "last_weight": weights[-1], "first_weight": weights[0],
            })
        elif is_plateau:
            plateaus.append({
                "exercise_name": name, "status": "plateau",
                "sessions_checked": len(recent), "weeks_stagnant": span_weeks,
                "last_weight": weights[-1], "first_weight": weights[0],
            })
    plateaus.sort(key=lambda x: x["weeks_stagnant"], reverse=True)

    # Consistency
    w12 = today - timedelta(weeks=12)
    recent_12w = [w for w in workouts if w.logged_at.date() >= w12]

    # Weekly volume trend (12 weeks)
    weekly_vol: dict[str, float] = defaultdict(float)
    for w in workouts:
        w_date = w.logged_at.date()
        if w_date < w12:
            continue
        iso = w_date.strftime("%Y-W%W")
        vol = w.total_volume_kg or 0.0
        if vol == 0:
            for ex in w.exercises:
                for s in ex.workout_sets:
                    if s.set_type == "working" and s.weight_kg and s.reps:
                        vol += s.reps * s.weight_kg
        weekly_vol[iso] += vol

    volume_trend = [
        {"week": k, "total_volume": round(v, 1)}
        for k, v in sorted(weekly_vol.items())
    ]

    strongest = personal_records[0] if personal_records else None
    fastest = strength_trends[0] if strength_trends else None

    return {
        "personal_records": personal_records,
        "strength_trends": strength_trends[:10],
        "plateaus": plateaus,
        "consistency": {
            "total_workouts_12w": len(recent_12w),
            "avg_workouts_per_week": round(len(recent_12w) / 12, 1),
        },
        "volume_trend": volume_trend,
        "top_lifts": [
            {"exercise_name": r["exercise_name"], "best_weight": r["weight_pr"], "date": r["weight_pr_date"]}
            for r in personal_records[:5]
        ],
        "fastest_improving": fastest,
        "strongest_lift": strongest,
    }
