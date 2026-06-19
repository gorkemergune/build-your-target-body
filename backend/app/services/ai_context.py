from datetime import date, timedelta

from sqlalchemy.orm import Session, joinedload

from app.models.body_fat_log import BodyFatLog
from app.models.goal import Goal
from app.models.measurement_log import MeasurementLog
from app.models.nutrition_log import NutritionLog
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout


def build_user_context(user: User, db: Session) -> str:
    today = date.today()
    cutoff_7 = today - timedelta(days=7)
    cutoff_14 = today - timedelta(days=14)
    cutoff_30 = today - timedelta(days=30)
    cutoff_60 = today - timedelta(days=60)

    # ── Fetch all data ───────────────────────────────────────────────────────
    all_weight = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == user.id)
        .order_by(WeightLog.logged_at.asc())
        .all()
    )
    latest_fat = (
        db.query(BodyFatLog)
        .filter(BodyFatLog.user_id == user.id)
        .order_by(BodyFatLog.logged_at.desc())
        .first()
    )
    active_goal = (
        db.query(Goal)
        .filter(Goal.user_id == user.id, Goal.is_active == True)  # noqa: E712
        .first()
    )
    latest_meas = (
        db.query(MeasurementLog)
        .filter(MeasurementLog.user_id == user.id)
        .order_by(MeasurementLog.logged_at.desc())
        .first()
    )
    nutrition_logs = (
        db.query(NutritionLog)
        .filter(NutritionLog.user_id == user.id, NutritionLog.logged_date >= cutoff_14)
        .order_by(NutritionLog.logged_date.desc())
        .all()
    )
    recent_workouts = (
        db.query(Workout)
        .options(joinedload(Workout.exercises))
        .filter(Workout.user_id == user.id, Workout.logged_at >= cutoff_14)
        .order_by(Workout.logged_at.desc())
        .all()
    )

    # ── Derived metrics ──────────────────────────────────────────────────────
    def _avg(vals: list[float]) -> float | None:
        return sum(vals) / len(vals) if vals else None

    first_w = all_weight[0] if all_weight else None
    latest_w = all_weight[-1] if all_weight else None

    w_last7 = [w.weight_kg for w in all_weight if w.logged_at.date() >= cutoff_7]
    w_prev7 = [w.weight_kg for w in all_weight if cutoff_14 <= w.logged_at.date() < cutoff_7]
    weekly_change: float | None = None
    if w_last7 and w_prev7:
        a, b = _avg(w_last7), _avg(w_prev7)
        if a is not None and b is not None:
            weekly_change = round(a - b, 2)

    w_last30 = [w.weight_kg for w in all_weight if w.logged_at.date() >= cutoff_30]
    w_prev30 = [w.weight_kg for w in all_weight if cutoff_60 <= w.logged_at.date() < cutoff_30]
    monthly_change: float | None = None
    if w_last30 and w_prev30:
        a, b = _avg(w_last30), _avg(w_prev30)
        if a is not None and b is not None:
            monthly_change = round(a - b, 2)

    progress_pct: float | None = None
    days_remaining: int | None = None
    if active_goal and latest_w:
        start_w = active_goal.start_weight_kg or (first_w.weight_kg if first_w else None)
        if start_w and active_goal.target_weight_kg:
            total_needed = active_goal.target_weight_kg - start_w
            if total_needed != 0:
                progress_pct = round(
                    min(100, max(0, (latest_w.weight_kg - start_w) / total_needed * 100)), 1
                )
        if active_goal.target_date:
            days_remaining = max(0, (active_goal.target_date.date() - today).days)

    # Plateau
    p14 = [w.weight_kg for w in all_weight if w.logged_at.date() >= cutoff_14]
    if len(p14) >= 3 and (max(p14) - min(p14)) < 0.5:
        plateau_text = f"DETECTED — weight changed only {round(max(p14) - min(p14), 2)} kg over last 14 days"
    else:
        plateau_text = "Not detected"

    # Health score components
    w_days_14 = len({w.logged_at.date() for w in all_weight if w.logged_at.date() >= cutoff_14})
    n_days_14 = len({n.logged_date for n in nutrition_logs})
    wo_days_14 = len({
        (w.logged_at.date() if hasattr(w.logged_at, "date") else w.logged_at)
        for w in recent_workouts
    })
    ws = min(25, round(w_days_14 / 14 * 25))
    ns = min(25, round(n_days_14 / 14 * 25))
    wos = min(25, round(wo_days_14 / 6 * 25))
    gps = min(25, round(progress_pct / 100 * 25)) if progress_pct is not None else 0
    health_score = ws + ns + wos + gps

    # ── Build context string ─────────────────────────────────────────────────
    L: list[str] = []

    L.append("=== USER PROFILE ===")
    L.append(f"Name: {user.full_name or 'Not set'}")
    if user.height_cm:
        L.append(f"Height: {user.height_cm} cm")
    if user.activity_level:
        L.append(f"Activity level: {user.activity_level.replace('_', ' ')}")
    lang = user.preferred_language or "en"
    L.append(f"Respond in: {'Turkish' if lang == 'tr' else 'English'}")

    L.append("\n=== CURRENT STATUS ===")
    if latest_w:
        L.append(f"Current weight: {latest_w.weight_kg} kg (logged {latest_w.logged_at.date().isoformat()})")
        if first_w and first_w.id != latest_w.id:
            chg = round(latest_w.weight_kg - first_w.weight_kg, 2)
            L.append(f"Change since first log ({first_w.logged_at.date().isoformat()}): {'+' if chg >= 0 else ''}{chg} kg")
    else:
        L.append("Current weight: No data logged yet")
    if latest_fat:
        L.append(f"Current body fat: {latest_fat.body_fat_pct}% (logged {latest_fat.logged_at.date().isoformat()})")
    else:
        L.append("Current body fat: No data logged yet")
    L.append(f"Total weight log entries: {len(all_weight)}")

    L.append("\n=== ACTIVE GOAL ===")
    if active_goal:
        L.append(f"Type: {active_goal.goal_type.replace('_', ' ').title()}")
        if active_goal.start_weight_kg:
            L.append(f"Starting weight: {active_goal.start_weight_kg} kg")
        if active_goal.target_weight_kg:
            L.append(f"Target weight: {active_goal.target_weight_kg} kg")
        if active_goal.start_body_fat_pct:
            L.append(f"Starting body fat: {active_goal.start_body_fat_pct}%")
        if active_goal.target_body_fat_pct:
            L.append(f"Target body fat: {active_goal.target_body_fat_pct}%")
        if active_goal.target_date:
            L.append(f"Target date: {active_goal.target_date.date().isoformat()}")
        if days_remaining is not None:
            L.append(f"Days remaining: {days_remaining}")
        L.append(
            f"Progress toward goal: {progress_pct}%"
            if progress_pct is not None
            else "Progress: Cannot calculate (need start weight, target weight, and weight log data)"
        )
    else:
        L.append("No active goal set")

    L.append("\n=== PROGRESS METRICS ===")
    if weekly_change is not None:
        L.append(f"Weekly change (avg last 7d vs 7-14d ago): {'+' if weekly_change >= 0 else ''}{weekly_change} kg")
    else:
        L.append("Weekly change: Not enough data (need logs in both last 7d and 7-14d windows)")
    if monthly_change is not None:
        L.append(f"Monthly change (avg last 30d vs 30-60d ago): {'+' if monthly_change >= 0 else ''}{monthly_change} kg")
    else:
        L.append("Monthly change: Not enough data")

    L.append("\n=== HEALTH SCORE ===")
    L.append(f"Total: {health_score}/100")
    L.append(f"  Weight tracking (last 14d): {w_days_14}/14 days logged → {ws}/25 pts")
    L.append(f"  Nutrition tracking (last 14d): {n_days_14}/14 days logged → {ns}/25 pts")
    L.append(f"  Workout consistency (last 14d): {wo_days_14} workout days → {wos}/25 pts (target ≥6)")
    L.append(f"  Goal progress: {gps}/25 pts")

    L.append("\n=== PLATEAU STATUS ===")
    L.append(f"Plateau: {plateau_text}")

    L.append("\n=== LATEST BODY MEASUREMENTS ===")
    if latest_meas:
        mfields = [
            ("Chest", latest_meas.chest_cm),
            ("Waist", latest_meas.waist_cm),
            ("Hips", latest_meas.hips_cm),
            ("Neck", latest_meas.neck_cm),
            ("Left arm", latest_meas.left_arm_cm),
            ("Right arm", latest_meas.right_arm_cm),
            ("Left thigh", latest_meas.left_thigh_cm),
            ("Right thigh", latest_meas.right_thigh_cm),
        ]
        for label, val in mfields:
            if val is not None:
                L.append(f"  {label}: {val} cm")
        L.append(f"  (Measured: {latest_meas.logged_at.date().isoformat()})")
    else:
        L.append("No body measurements recorded")

    L.append("\n=== LAST 14 DAYS NUTRITION ===")
    if nutrition_logs:
        for n in nutrition_logs:
            parts = [n.logged_date.isoformat() + ":"]
            if n.total_calories is not None:
                parts.append(f"{round(n.total_calories)} kcal")
            if n.protein_g is not None:
                parts.append(f"protein {round(n.protein_g)}g")
            if n.carbs_g is not None:
                parts.append(f"carbs {round(n.carbs_g)}g")
            if n.fat_g is not None:
                parts.append(f"fat {round(n.fat_g)}g")
            if n.water_ml is not None:
                parts.append(f"water {round(n.water_ml)}ml")
            L.append("  " + " | ".join(parts))
    else:
        L.append("No nutrition data logged in the last 14 days")

    L.append("\n=== LAST 14 DAYS WORKOUTS ===")
    if recent_workouts:
        for w in recent_workouts:
            dur = f" ({w.duration_minutes} min)" if w.duration_minutes else ""
            L.append(f"  {w.logged_at.date().isoformat()}: {w.name}{dur}")
            for ex in w.exercises:
                ex_str = f"    - {ex.exercise_name}"
                if ex.sets and ex.reps:
                    ex_str += f": {ex.sets} sets × {ex.reps} reps"
                if ex.weight_kg:
                    ex_str += f" @ {ex.weight_kg} kg"
                L.append(ex_str)
    else:
        L.append("No workouts logged in the last 14 days")

    return "\n".join(L)
