from datetime import date, timedelta

from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.body_fat_log import BodyFatLog
from app.models.goal import Goal
from app.models.measurement_log import MeasurementLog
from app.models.nutrition_log import NutritionLog
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout

_WEEKLY_PROMPT = """\
You are a professional fitness coach generating a structured weekly progress report.

STRICT RULES:
1. Use ONLY the data in the USER DATA section. Never invent or estimate numbers.
2. If a section has no data, write exactly: "No data logged this week — start tracking to unlock this analysis."
3. Answer for each section: What happened? Why might this be? What should the user do?
4. Be specific — reference actual numbers. Avoid generic tips.
5. Respond in the language specified under USER DATA → Language.
6. Use exactly these markdown section headers (include the ## prefix):

## Weight Analysis
## Body Fat Analysis
## Workout Analysis
## Nutrition Analysis
## Consistency Analysis
## This Week's Strengths
## Areas for Improvement
## Action Plan for Next Week

USER DATA:
{context}

Generate the weekly report now. Every recommendation must be grounded in the numbers above.\
"""

_MONTHLY_PROMPT = """\
You are a professional fitness coach generating a comprehensive monthly progress report.

STRICT RULES:
1. Use ONLY the data in the USER DATA section. Never invent or estimate numbers.
2. If a section has no data, write exactly: "No data logged this month — start tracking to unlock this analysis."
3. Answer: What happened? Why? What should the user do next month?
4. Be specific — reference actual numbers and trends. Avoid generic advice.
5. Respond in the language specified under USER DATA → Language.
6. Use exactly these markdown section headers (include the ## prefix):

## Monthly Weight Trend
## Body Composition Progress
## Goal Forecast Update
## Workout Performance
## Nutrition Overview
## Plateau & Risk Analysis
## Measurement Changes
## Focus Areas for Next Month

USER DATA:
{context}

Generate the monthly report. Reference specific numbers and trends from the data above.\
"""


def _avg(vals: list[float]) -> float | None:
    return round(sum(vals) / len(vals), 2) if vals else None


def _fmt_change(val: float) -> str:
    return f"+{val}" if val >= 0 else str(val)


def _build_weekly_context(user: User, db: Session) -> str:
    today = date.today()
    week_start = today - timedelta(days=7)
    prev_week_start = today - timedelta(days=14)

    # Weight
    w_this = db.query(WeightLog).filter(
        WeightLog.user_id == user.id, WeightLog.logged_at >= week_start
    ).order_by(WeightLog.logged_at.asc()).all()
    w_prev = db.query(WeightLog).filter(
        WeightLog.user_id == user.id,
        WeightLog.logged_at >= prev_week_start,
        WeightLog.logged_at < week_start,
    ).order_by(WeightLog.logged_at.asc()).all()

    # Body fat
    fat_this = db.query(BodyFatLog).filter(
        BodyFatLog.user_id == user.id, BodyFatLog.logged_at >= week_start
    ).order_by(BodyFatLog.logged_at.asc()).all()

    # Workouts
    wo_this = db.query(Workout).options(joinedload(Workout.exercises)).filter(
        Workout.user_id == user.id, Workout.logged_at >= week_start
    ).order_by(Workout.logged_at.asc()).all()
    wo_prev_count = db.query(Workout).filter(
        Workout.user_id == user.id,
        Workout.logged_at >= prev_week_start,
        Workout.logged_at < week_start,
    ).count()

    # Nutrition
    nut_this = db.query(NutritionLog).filter(
        NutritionLog.user_id == user.id, NutritionLog.logged_date >= week_start
    ).order_by(NutritionLog.logged_date.asc()).all()
    nut_prev = db.query(NutritionLog).filter(
        NutritionLog.user_id == user.id,
        NutritionLog.logged_date >= prev_week_start,
        NutritionLog.logged_date < week_start,
    ).all()

    # Active goal
    goal = db.query(Goal).filter(Goal.user_id == user.id, Goal.is_active == True).first()  # noqa: E712

    # Consistency (active days this week)
    active_days: set[date] = set()
    for w in w_this:
        active_days.add(w.logged_at.date())
    for n in nut_this:
        active_days.add(n.logged_date)
    for w in wo_this:
        active_days.add(w.logged_at.date())

    L: list[str] = []
    lang = user.preferred_language or "en"
    L.append(f"Language: {'Turkish' if lang == 'tr' else 'English'}")
    L.append(f"User: {user.full_name or 'Unknown'}")
    if user.height_cm:
        L.append(f"Height: {user.height_cm} cm")
    L.append(f"Report period: {week_start.isoformat()} to {today.isoformat()}")

    # Goal
    L.append("\n--- ACTIVE GOAL ---")
    if goal:
        L.append(f"Goal type: {goal.goal_type.replace('_', ' ').title()}")
        if goal.start_weight_kg:
            L.append(f"Start weight: {goal.start_weight_kg} kg")
        if goal.target_weight_kg:
            L.append(f"Target weight: {goal.target_weight_kg} kg")
        if goal.target_body_fat_pct:
            L.append(f"Target body fat: {goal.target_body_fat_pct}%")
        if goal.target_date:
            days_left = max(0, (goal.target_date.date() - today).days)
            L.append(f"Target date: {goal.target_date.date().isoformat()} ({days_left} days remaining)")
    else:
        L.append("No active goal set")

    # Weight this week
    L.append("\n--- WEIGHT THIS WEEK ---")
    if w_this:
        vals = [w.weight_kg for w in w_this]
        L.append(f"Logs: {len(w_this)}")
        L.append(f"Start of week: {w_this[0].weight_kg} kg")
        L.append(f"End of week: {w_this[-1].weight_kg} kg")
        L.append(f"Weekly change: {_fmt_change(round(w_this[-1].weight_kg - w_this[0].weight_kg, 2))} kg")
        L.append(f"Average: {_avg(vals)} kg")
        L.append(f"Min: {min(vals)} kg  |  Max: {max(vals)} kg")
        if w_prev:
            prev_avg = _avg([w.weight_kg for w in w_prev])
            curr_avg = _avg(vals)
            if prev_avg and curr_avg:
                L.append(f"vs previous week avg: {_fmt_change(round(curr_avg - prev_avg, 2))} kg")
    else:
        L.append("No weight data logged this week")
        if w_prev:
            L.append(f"Previous week had {len(w_prev)} logs (avg {_avg([w.weight_kg for w in w_prev])} kg)")

    # Body fat
    L.append("\n--- BODY FAT THIS WEEK ---")
    if fat_this:
        vals = [f.body_fat_pct for f in fat_this]
        L.append(f"Logs: {len(fat_this)}")
        L.append(f"Start: {fat_this[0].body_fat_pct}%  |  End: {fat_this[-1].body_fat_pct}%")
        L.append(f"Change: {_fmt_change(round(fat_this[-1].body_fat_pct - fat_this[0].body_fat_pct, 2))}%")
        L.append(f"Average: {_avg(vals)}%")
    else:
        L.append("No body fat data logged this week")

    # Workouts
    L.append("\n--- WORKOUTS THIS WEEK ---")
    L.append(f"Sessions: {len(wo_this)}  |  Previous week: {wo_prev_count} sessions")
    if wo_this:
        durations = [w.duration_minutes for w in wo_this if w.duration_minutes]
        total_vol = sum(
            (ex.sets or 0) * (ex.reps or 0) * (ex.weight_kg or 0)
            for w in wo_this for ex in w.exercises
        )
        if durations:
            L.append(f"Total duration: {sum(durations)} min  |  Avg: {round(sum(durations)/len(durations))} min")
        if total_vol > 0:
            L.append(f"Total training volume: {round(total_vol)} kg")
        for w in wo_this:
            ex_summary = ", ".join(ex.exercise_name for ex in w.exercises[:4])
            L.append(f"  {w.logged_at.date().isoformat()}: {w.name}" + (f" — {ex_summary}" if ex_summary else ""))
    else:
        L.append("No workouts logged this week")

    # Nutrition
    L.append("\n--- NUTRITION THIS WEEK ---")
    L.append(f"Days logged: {len(nut_this)}/7")
    if nut_this:
        cal_vals = [n.total_calories for n in nut_this if n.total_calories]
        prot_vals = [n.protein_g for n in nut_this if n.protein_g]
        carb_vals = [n.carbs_g for n in nut_this if n.carbs_g]
        fat_vals = [n.fat_g for n in nut_this if n.fat_g]
        water_vals = [n.water_ml for n in nut_this if n.water_ml]
        if cal_vals:
            L.append(f"Avg calories: {_avg(cal_vals)} kcal  |  Min: {round(min(cal_vals))}  |  Max: {round(max(cal_vals))}")
        if prot_vals:
            L.append(f"Avg protein: {_avg(prot_vals)} g")
        if carb_vals:
            L.append(f"Avg carbs: {_avg(carb_vals)} g")
        if fat_vals:
            L.append(f"Avg fat: {_avg(fat_vals)} g")
        if water_vals:
            L.append(f"Avg water: {_avg(water_vals)} ml")

        if nut_prev:
            prev_cal = _avg([n.total_calories for n in nut_prev if n.total_calories])
            curr_cal = _avg(cal_vals) if cal_vals else None
            if prev_cal and curr_cal:
                L.append(f"vs previous week avg calories: {_fmt_change(round(curr_cal - prev_cal, 0))}")

        L.append("Daily breakdown:")
        for n in nut_this:
            parts = [n.logged_date.isoformat() + ":"]
            if n.total_calories:
                parts.append(f"{round(n.total_calories)} kcal")
            if n.protein_g:
                parts.append(f"P:{round(n.protein_g)}g")
            if n.carbs_g:
                parts.append(f"C:{round(n.carbs_g)}g")
            if n.fat_g:
                parts.append(f"F:{round(n.fat_g)}g")
            L.append("  " + " ".join(parts))
    else:
        L.append("No nutrition data logged this week")

    # Consistency
    L.append("\n--- CONSISTENCY ---")
    L.append(f"Active days this week: {len(active_days)}/7")
    L.append(f"Weight tracking: {len(w_this)}/7 days")
    L.append(f"Nutrition tracking: {len(nut_this)}/7 days")
    L.append(f"Workout sessions: {len(wo_this)}")

    return "\n".join(L)


def _build_monthly_context(user: User, db: Session) -> str:
    today = date.today()
    month_start = today - timedelta(days=30)
    prev_month_start = today - timedelta(days=60)

    w_this = db.query(WeightLog).filter(
        WeightLog.user_id == user.id, WeightLog.logged_at >= month_start
    ).order_by(WeightLog.logged_at.asc()).all()
    w_prev = db.query(WeightLog).filter(
        WeightLog.user_id == user.id,
        WeightLog.logged_at >= prev_month_start,
        WeightLog.logged_at < month_start,
    ).all()

    fat_this = db.query(BodyFatLog).filter(
        BodyFatLog.user_id == user.id, BodyFatLog.logged_at >= month_start
    ).order_by(BodyFatLog.logged_at.asc()).all()
    fat_prev = db.query(BodyFatLog).filter(
        BodyFatLog.user_id == user.id,
        BodyFatLog.logged_at >= prev_month_start,
        BodyFatLog.logged_at < month_start,
    ).all()

    wo_this = db.query(Workout).options(joinedload(Workout.exercises)).filter(
        Workout.user_id == user.id, Workout.logged_at >= month_start
    ).order_by(Workout.logged_at.asc()).all()
    wo_prev_count = db.query(Workout).filter(
        Workout.user_id == user.id,
        Workout.logged_at >= prev_month_start,
        Workout.logged_at < month_start,
    ).count()

    nut_this = db.query(NutritionLog).filter(
        NutritionLog.user_id == user.id, NutritionLog.logged_date >= month_start
    ).all()
    nut_prev = db.query(NutritionLog).filter(
        NutritionLog.user_id == user.id,
        NutritionLog.logged_date >= prev_month_start,
        NutritionLog.logged_date < month_start,
    ).all()

    meas_this = db.query(MeasurementLog).filter(
        MeasurementLog.user_id == user.id, MeasurementLog.logged_at >= month_start
    ).order_by(MeasurementLog.logged_at.asc()).all()

    goal = db.query(Goal).filter(Goal.user_id == user.id, Goal.is_active == True).first()  # noqa: E712

    # Plateau detection
    p14 = [w.weight_kg for w in w_this if w.logged_at.date() >= today - timedelta(days=14)]
    plateau_text = "Not detected"
    if len(p14) >= 3 and (max(p14) - min(p14)) < 0.5:
        plateau_text = f"DETECTED — weight changed only {round(max(p14) - min(p14), 2)} kg in last 14 days"

    # Goal progress
    progress_pct = None
    eta_str = None
    if goal and w_this:
        start_w = goal.start_weight_kg or w_this[0].weight_kg
        if start_w and goal.target_weight_kg and (goal.target_weight_kg - start_w) != 0:
            progress_pct = round(
                min(100, max(0, (w_this[-1].weight_kg - start_w) / (goal.target_weight_kg - start_w) * 100)), 1
            )
        if goal.target_date:
            days_left = max(0, (goal.target_date.date() - today).days)
            if w_this and len(w_this) >= 2:
                days_of_data = (w_this[-1].logged_at.date() - w_this[0].logged_at.date()).days or 1
                weekly_rate = ((w_this[-1].weight_kg - w_this[0].weight_kg) / days_of_data) * 7
                if weekly_rate != 0 and goal.target_weight_kg:
                    remaining = goal.target_weight_kg - w_this[-1].weight_kg
                    weeks_needed = remaining / weekly_rate
                    if weeks_needed > 0:
                        from datetime import timedelta as td
                        eta_str = (today + td(weeks=weeks_needed)).isoformat()

    L: list[str] = []
    lang = user.preferred_language or "en"
    L.append(f"Language: {'Turkish' if lang == 'tr' else 'English'}")
    L.append(f"User: {user.full_name or 'Unknown'}")
    if user.height_cm:
        L.append(f"Height: {user.height_cm} cm")
    L.append(f"Report period: {month_start.isoformat()} to {today.isoformat()} (last 30 days)")

    L.append("\n--- ACTIVE GOAL ---")
    if goal:
        L.append(f"Type: {goal.goal_type.replace('_', ' ').title()}")
        if goal.start_weight_kg:
            L.append(f"Start weight: {goal.start_weight_kg} kg")
        if goal.target_weight_kg:
            L.append(f"Target weight: {goal.target_weight_kg} kg")
        if goal.target_body_fat_pct:
            L.append(f"Target body fat: {goal.target_body_fat_pct}%")
        if goal.target_date:
            days_left = max(0, (goal.target_date.date() - today).days)
            L.append(f"Target date: {goal.target_date.date().isoformat()} ({days_left} days remaining)")
        if progress_pct is not None:
            L.append(f"Current progress: {progress_pct}%")
        if eta_str:
            L.append(f"ETA at current rate: {eta_str}")
    else:
        L.append("No active goal")

    L.append("\n--- WEIGHT (LAST 30 DAYS) ---")
    if w_this:
        vals = [w.weight_kg for w in w_this]
        L.append(f"Total logs: {len(w_this)}")
        L.append(f"Start: {w_this[0].weight_kg} kg ({w_this[0].logged_at.date().isoformat()})")
        L.append(f"End: {w_this[-1].weight_kg} kg ({w_this[-1].logged_at.date().isoformat()})")
        L.append(f"30-day change: {_fmt_change(round(w_this[-1].weight_kg - w_this[0].weight_kg, 2))} kg")
        L.append(f"Average: {_avg(vals)} kg  |  Min: {min(vals)} kg  |  Max: {max(vals)} kg")
        if w_prev:
            prev_avg = _avg([w.weight_kg for w in w_prev])
            curr_avg = _avg(vals)
            if prev_avg and curr_avg:
                L.append(f"vs previous 30 days avg: {_fmt_change(round(curr_avg - prev_avg, 2))} kg")
    else:
        L.append("No weight data logged this month")

    L.append("\n--- BODY FAT (LAST 30 DAYS) ---")
    if fat_this:
        vals = [f.body_fat_pct for f in fat_this]
        L.append(f"Logs: {len(fat_this)}")
        L.append(f"Start: {fat_this[0].body_fat_pct}%  |  End: {fat_this[-1].body_fat_pct}%")
        L.append(f"30-day change: {_fmt_change(round(fat_this[-1].body_fat_pct - fat_this[0].body_fat_pct, 2))}%")
        if fat_prev:
            prev_avg = _avg([f.body_fat_pct for f in fat_prev])
            curr_avg = _avg(vals)
            if prev_avg and curr_avg:
                L.append(f"vs previous month: {_fmt_change(round(curr_avg - prev_avg, 2))}%")
    else:
        L.append("No body fat data logged this month")

    L.append("\n--- WORKOUTS (LAST 30 DAYS) ---")
    L.append(f"Sessions: {len(wo_this)}  |  Previous month: {wo_prev_count}")
    if wo_this:
        durations = [w.duration_minutes for w in wo_this if w.duration_minutes]
        total_vol = sum(
            (ex.sets or 0) * (ex.reps or 0) * (ex.weight_kg or 0)
            for w in wo_this for ex in w.exercises
        )
        if durations:
            L.append(f"Total duration: {sum(durations)} min  |  Avg per session: {round(sum(durations)/len(durations))} min")
        if total_vol > 0:
            L.append(f"Total volume: {round(total_vol)} kg")
        exercise_freq: dict[str, int] = {}
        for w in wo_this:
            for ex in w.exercises:
                exercise_freq[ex.exercise_name] = exercise_freq.get(ex.exercise_name, 0) + 1
        if exercise_freq:
            top = sorted(exercise_freq.items(), key=lambda x: x[1], reverse=True)[:5]
            L.append("Most frequent exercises: " + ", ".join(f"{n} ({c}x)" for n, c in top))

    L.append("\n--- NUTRITION (LAST 30 DAYS) ---")
    L.append(f"Days logged: {len(nut_this)}/30")
    if nut_this:
        cal_vals = [n.total_calories for n in nut_this if n.total_calories]
        prot_vals = [n.protein_g for n in nut_this if n.protein_g]
        if cal_vals:
            L.append(f"Avg calories: {_avg(cal_vals)} kcal")
        if prot_vals:
            L.append(f"Avg protein: {_avg(prot_vals)} g")
        if nut_prev:
            prev_cal = _avg([n.total_calories for n in nut_prev if n.total_calories])
            curr_cal = _avg(cal_vals) if cal_vals else None
            if prev_cal and curr_cal:
                L.append(f"vs previous month avg calories: {_fmt_change(round(curr_cal - prev_cal, 0))}")

    L.append("\n--- MEASUREMENTS ---")
    if meas_this:
        first_m = meas_this[0]
        last_m = meas_this[-1]
        L.append(f"Measurements taken: {len(meas_this)}")
        mfields = [
            ("Chest", "chest_cm"), ("Waist", "waist_cm"), ("Hips", "hips_cm"),
            ("Left arm", "left_arm_cm"), ("Right arm", "right_arm_cm"),
        ]
        for label, attr in mfields:
            v1, v2 = getattr(first_m, attr), getattr(last_m, attr)
            if v1 is not None and v2 is not None:
                L.append(f"  {label}: {v1} → {v2} cm ({_fmt_change(round(v2 - v1, 1))} cm)")
    else:
        L.append("No body measurements logged this month")

    L.append("\n--- PLATEAU DETECTION ---")
    L.append(f"Plateau status: {plateau_text}")

    L.append("\n--- CONSISTENCY ---")
    active_days: set[date] = set()
    for w in w_this:
        active_days.add(w.logged_at.date())
    for n in nut_this:
        active_days.add(n.logged_date)
    for w in wo_this:
        active_days.add(w.logged_at.date())
    L.append(f"Active days (any tracking): {len(active_days)}/30")
    L.append(f"Weight tracking: {len(w_this)} logs")
    L.append(f"Nutrition tracking: {len(nut_this)}/30 days")
    L.append(f"Workouts: {len(wo_this)} sessions")

    return "\n".join(L)


def _call_gemini(prompt: str) -> str:
    if not settings.GEMINI_API_KEY:
        return (
            "## AI Report Unavailable\n\n"
            "GEMINI_API_KEY is not configured. "
            "Set it in your .env file to enable AI report generation."
        )
    import google.generativeai as genai  # lazy import

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")
    response = model.generate_content(prompt)
    return response.text


async def generate_weekly_report(user: User, db: Session) -> tuple[str, str]:
    context = _build_weekly_context(user, db)
    prompt = _WEEKLY_PROMPT.format(context=context)
    content = _call_gemini(prompt)
    today = date.today()
    week_start = today - timedelta(days=7)
    title = f"Weekly Report — {week_start.strftime('%b %d')} to {today.strftime('%b %d, %Y')}"
    return title, content


async def generate_monthly_report(user: User, db: Session) -> tuple[str, str]:
    context = _build_monthly_context(user, db)
    prompt = _MONTHLY_PROMPT.format(context=context)
    content = _call_gemini(prompt)
    today = date.today()
    month_start = today - timedelta(days=30)
    title = f"Monthly Report — {month_start.strftime('%b %d')} to {today.strftime('%b %d, %Y')}"
    return title, content
