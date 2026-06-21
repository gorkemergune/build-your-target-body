from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.body_fat_log import BodyFatLog
from app.models.goal import Goal
from app.models.nutrition_log import NutritionLog
from app.models.user import User
from app.models.weight_log import WeightLog
from app.models.workout import Workout

router = APIRouter(prefix="/share", tags=["share"])

_WEIGHT_LOSS_THRESHOLDS = [5, 10, 15, 20, 25, 30]
_WEIGHT_GAIN_THRESHOLDS = [5, 10, 15, 20]
_BODY_FAT_THRESHOLDS = [2, 5, 10, 15]
_WORKOUT_THRESHOLDS = [10, 25, 50, 100, 200]
_STREAK_THRESHOLDS = [7, 14, 30, 60, 90, 100]


def _streak_data(user_id: int, db: Session) -> tuple[int, int]:
    active: set[date] = set()
    for (d,) in db.query(WeightLog.logged_at).filter(WeightLog.user_id == user_id).all():
        active.add(d.date() if hasattr(d, "date") else d)
    for (d,) in db.query(NutritionLog.logged_date).filter(NutritionLog.user_id == user_id).all():
        active.add(d)
    for (d,) in db.query(Workout.logged_at).filter(Workout.user_id == user_id).all():
        active.add(d.date() if hasattr(d, "date") else d)

    if not active:
        return 0, 0

    today = date.today()
    check = today if today in active else today - timedelta(days=1)
    current = 0
    while check in active:
        current += 1
        check -= timedelta(days=1)

    sorted_d = sorted(active)
    longest, run = 1, 1
    for i in range(1, len(sorted_d)):
        run = run + 1 if (sorted_d[i] - sorted_d[i - 1]).days == 1 else 1
        longest = max(longest, run)

    return current, longest


@router.get("/milestones")
def get_milestones(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    milestones = []

    weight_logs = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == current_user.id)
        .order_by(WeightLog.logged_at.asc())
        .all()
    )
    if len(weight_logs) >= 2:
        first_w = weight_logs[0].weight_kg
        last_w = weight_logs[-1].weight_kg
        change = last_w - first_w
        if change < 0:
            for t in _WEIGHT_LOSS_THRESHOLDS:
                if abs(change) >= t:
                    milestones.append({
                        "id": f"weight_loss_{t}",
                        "type": "weight_loss",
                        "metric": f"-{t}kg",
                        "title": "Weight Lost",
                        "subtitle": f"{first_w:.1f}kg → {last_w:.1f}kg",
                        "share_text": f"I just lost {t}kg with Build Your Target Body! 💪",
                    })
        elif change > 0:
            for t in _WEIGHT_GAIN_THRESHOLDS:
                if change >= t:
                    milestones.append({
                        "id": f"weight_gain_{t}",
                        "type": "weight_gain",
                        "metric": f"+{t}kg",
                        "title": "Weight Gained",
                        "subtitle": f"{first_w:.1f}kg → {last_w:.1f}kg",
                        "share_text": f"I've gained {t}kg on my fitness journey with Build Your Target Body! 💪",
                    })

    fat_logs = (
        db.query(BodyFatLog)
        .filter(BodyFatLog.user_id == current_user.id)
        .order_by(BodyFatLog.logged_at.asc())
        .all()
    )
    if len(fat_logs) >= 2:
        first_f = fat_logs[0].body_fat_pct
        last_f = fat_logs[-1].body_fat_pct
        fat_drop = first_f - last_f
        if fat_drop > 0:
            for t in _BODY_FAT_THRESHOLDS:
                if fat_drop >= t:
                    milestones.append({
                        "id": f"body_fat_{t}",
                        "type": "body_fat",
                        "metric": f"-{t}%",
                        "title": "Body Fat Reduced",
                        "subtitle": f"{first_f:.1f}% → {last_f:.1f}%",
                        "share_text": f"I reduced my body fat by {t}% with Build Your Target Body! 📉",
                    })

    workout_count = (
        db.query(Workout).filter(Workout.user_id == current_user.id).count()
    )
    for t in _WORKOUT_THRESHOLDS:
        if workout_count >= t:
            milestones.append({
                "id": f"workout_{t}",
                "type": "workout",
                "metric": str(t),
                "title": "Workouts Logged",
                "subtitle": f"{workout_count} total workouts completed",
                "share_text": f"I've logged {t} workouts on Build Your Target Body! 🏋️",
            })

    current_streak, longest_streak = _streak_data(current_user.id, db)
    best_streak = max(current_streak, longest_streak)
    for t in _STREAK_THRESHOLDS:
        if best_streak >= t:
            milestones.append({
                "id": f"streak_{t}",
                "type": "streak",
                "metric": str(t),
                "title": "Day Streak",
                "subtitle": "Consecutive active days",
                "share_text": f"I've maintained a {t} day active streak on Build Your Target Body! 🔥",
            })

    active_goal = (
        db.query(Goal)
        .filter(Goal.user_id == current_user.id, Goal.is_active == True)  # noqa: E712
        .first()
    )
    if active_goal and active_goal.target_weight_kg and weight_logs:
        latest_w = weight_logs[-1].weight_kg
        goal_met = (
            active_goal.goal_type in ("weight_loss", "recomp") and latest_w <= active_goal.target_weight_kg
        ) or (
            active_goal.goal_type in ("weight_gain", "muscle_gain") and latest_w >= active_goal.target_weight_kg
        )
        if goal_met:
            milestones.append({
                "id": "goal_achieved",
                "type": "goal",
                "metric": "100%",
                "title": "Goal Achieved!",
                "subtitle": f"Target: {active_goal.target_weight_kg}kg reached",
                "share_text": "I achieved my fitness goal with Build Your Target Body! 🏆",
            })

    parts = (current_user.full_name or "").split()
    return {
        "milestones": milestones,
        "full_name": current_user.full_name or "",
        "first_name": parts[0] if parts else "",
    }
