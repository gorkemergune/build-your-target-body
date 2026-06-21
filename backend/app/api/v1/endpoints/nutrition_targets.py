"""
Nutrition Engine — targets, today summary, and adherence.

All calculations use Mifflin-St Jeor BMR + activity multiplier (TDEE).
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.goal import Goal
from app.models.nutrition_log import NutritionLog
from app.models.user import User
from app.models.weight_log import WeightLog
from app.services.nutrition_calc import calc_age, calc_bmr, calc_macros, calc_tdee

router = APIRouter(prefix="/nutrition", tags=["nutrition-engine"])

_MIN_FLOOR = {"male": 1500, "female": 1200}


def _compute_targets(user: User, db: Session) -> dict:
    """Core computation. Returns the full targets dict or incomplete notice."""
    missing = []
    if not user.gender:
        missing.append("gender")
    if not user.birth_date:
        missing.append("birth_date")
    if not user.height_cm:
        missing.append("height_cm")
    if not user.activity_level:
        missing.append("activity_level")

    latest_weight = (
        db.query(WeightLog)
        .filter(WeightLog.user_id == user.id)
        .order_by(WeightLog.logged_at.desc())
        .first()
    )
    if not latest_weight:
        missing.append("weight_log")

    if missing:
        return {"complete": False, "missing_fields": missing}

    age = calc_age(user.birth_date.date() if hasattr(user.birth_date, "date") else user.birth_date)
    bmr = calc_bmr(latest_weight.weight_kg, user.height_cm, age, user.gender)
    tdee = calc_tdee(bmr, user.activity_level)
    floor = _MIN_FLOOR.get(user.gender, 1400)

    active_goal = (
        db.query(Goal)
        .filter(Goal.user_id == user.id, Goal.is_active == True)  # noqa: E712
        .first()
    )
    goal_type = active_goal.goal_type if active_goal else None

    if goal_type in ("weight_loss", "recomp"):
        target_cal = max(floor, round(tdee - 500))
    elif goal_type in ("weight_gain", "muscle_gain"):
        target_cal = round(tdee + 350)
    else:
        target_cal = round(tdee)

    min_cal = max(floor, round(tdee - 750))
    max_cal = round(tdee + 600)

    protein_g, carbs_g, fat_g = calc_macros(target_cal, latest_weight.weight_kg, goal_type)

    return {
        "complete": True,
        "bmr": round(bmr),
        "tdee": round(tdee),
        "maintenance": round(tdee),
        "cutting": max(floor, round(tdee - 500)),
        "bulking": round(tdee + 350),
        "min_calories": min_cal,
        "target_calories": target_cal,
        "max_calories": max_cal,
        "protein_g": protein_g,
        "carbs_g": carbs_g,
        "fat_g": fat_g,
        "goal_type": goal_type,
        "activity_level": user.activity_level,
        "weight_kg": round(latest_weight.weight_kg, 1),
    }


@router.get("/targets")
def get_targets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _compute_targets(current_user, db)


@router.get("/today-summary")
def today_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    targets = _compute_targets(current_user, db)

    log = (
        db.query(NutritionLog)
        .filter(NutritionLog.user_id == current_user.id, NutritionLog.logged_date == today)
        .first()
    )

    consumed = {
        "calories": round(log.total_calories) if log and log.total_calories else 0,
        "protein_g": round(log.protein_g) if log and log.protein_g else 0,
        "carbs_g": round(log.carbs_g) if log and log.carbs_g else 0,
        "fat_g": round(log.fat_g) if log and log.fat_g else 0,
    }

    if targets.get("complete"):
        remaining = {
            "calories": max(0, targets["target_calories"] - consumed["calories"]),
            "protein_g": max(0, targets["protein_g"] - consumed["protein_g"]),
            "carbs_g": max(0, targets["carbs_g"] - consumed["carbs_g"]),
            "fat_g": max(0, targets["fat_g"] - consumed["fat_g"]),
        }
        target_macros = {
            "calories": targets["target_calories"],
            "protein_g": targets["protein_g"],
            "carbs_g": targets["carbs_g"],
            "fat_g": targets["fat_g"],
            "min_calories": targets["min_calories"],
            "max_calories": targets["max_calories"],
        }
    else:
        remaining = None
        target_macros = None

    return {
        "date": today.isoformat(),
        "targets_available": targets.get("complete", False),
        "targets": target_macros,
        "consumed": consumed,
        "remaining": remaining,
        "missing_fields": targets.get("missing_fields", []),
    }


@router.get("/adherence")
def get_adherence(
    days: int = Query(default=7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    targets = _compute_targets(current_user, db)
    if not targets.get("complete"):
        return {
            "targets_available": False,
            "days": days,
            "missing_fields": targets.get("missing_fields", []),
            "daily": [],
        }

    t_cal = targets["target_calories"]
    t_pro = targets["protein_g"]
    t_carbs = targets["carbs_g"]
    t_fat = targets["fat_g"]

    today = date.today()
    cutoff = today - timedelta(days=days - 1)

    logs = (
        db.query(NutritionLog)
        .filter(
            NutritionLog.user_id == current_user.id,
            NutritionLog.logged_date >= cutoff,
        )
        .all()
    )
    log_by_date = {l.logged_date: l for l in logs}

    daily = []
    for i in range(days):
        d = cutoff + timedelta(days=i)
        log = log_by_date.get(d)
        logged = log is not None and log.total_calories is not None

        def pct(val, target):
            if not logged or val is None or target == 0:
                return None
            return min(150, round(val / target * 100))

        daily.append({
            "date": d.isoformat(),
            "logged": logged,
            "calories_pct": pct(log.total_calories if log else None, t_cal),
            "protein_pct": pct(log.protein_g if log else None, t_pro),
            "carbs_pct": pct(log.carbs_g if log else None, t_carbs),
            "fat_pct": pct(log.fat_g if log else None, t_fat),
            "calories": round(log.total_calories) if log and log.total_calories else None,
            "protein_g": round(log.protein_g) if log and log.protein_g else None,
        })

    logged_days = [d for d in daily if d["logged"]]

    def avg_pct(key):
        vals = [d[key] for d in logged_days if d[key] is not None]
        return round(sum(vals) / len(vals)) if vals else None

    return {
        "targets_available": True,
        "days": days,
        "days_logged": len(logged_days),
        "targets": {
            "calories": t_cal,
            "protein_g": t_pro,
            "carbs_g": t_carbs,
            "fat_g": t_fat,
        },
        "avg_calories_pct": avg_pct("calories_pct"),
        "avg_protein_pct": avg_pct("protein_pct"),
        "avg_carbs_pct": avg_pct("carbs_pct"),
        "avg_fat_pct": avg_pct("fat_pct"),
        "daily": daily,
    }
