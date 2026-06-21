from datetime import date, timedelta
from math import ceil, floor
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalResponse
from app.services.gemini_client import call_gemini

router = APIRouter(prefix="/goals", tags=["goals"])


# ─── existing CRUD ────────────────────────────────────────────────────

@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Goal).filter(Goal.user_id == current_user.id, Goal.is_active == True).update({"is_active": False})  # noqa: E712
    goal = Goal(**payload.model_dump(), user_id=current_user.id)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/active", response_model=GoalResponse)
def get_active_goal(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goal = db.query(Goal).filter(Goal.user_id == current_user.id, Goal.is_active == True).first()  # noqa: E712
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active goal")
    return goal


@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return goal


# ─── Smart Goal Planner ───────────────────────────────────────────────

_ACTIVITY_MULT = {
    "sedentary": 1.2,
    "lightly_active": 1.375,
    "moderately_active": 1.55,
    "very_active": 1.725,
    "extremely_active": 1.9,
}

# kcal per kg of actual tissue change (mixed fat+lean context)
_KCAL_PER_KG_LOSS = 7000
_KCAL_PER_KG_GAIN = 7000

# (deficit_or_surplus_kcal, scenario_label)
_LOSS_CONFIGS = [
    (-250, "conservative"),
    (-500, "balanced"),
    (-750, "aggressive"),
]
_GAIN_CONFIGS = [
    (200, "conservative"),
    (350, "balanced"),
    (500, "aggressive"),
]
_RECOMP_CONFIGS = [
    (0, "conservative"),
    (-150, "balanced"),
    (-250, "aggressive"),
]

# Protein g/kg for each (goal_type, scenario)
_PROTEIN_MAP = {
    ("weight_loss", "conservative"): 1.8,
    ("weight_loss", "balanced"): 2.2,
    ("weight_loss", "aggressive"): 2.6,
    ("weight_gain", "conservative"): 1.6,
    ("weight_gain", "balanced"): 1.8,
    ("weight_gain", "aggressive"): 2.0,
    ("muscle_gain", "conservative"): 1.8,
    ("muscle_gain", "balanced"): 2.0,
    ("muscle_gain", "aggressive"): 2.2,
    ("recomp", "conservative"): 2.2,
    ("recomp", "balanced"): 2.4,
    ("recomp", "aggressive"): 2.6,
}


def _bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + 5 if gender == "male" else base - 161


def _tdee(bmr: float, activity_level: str, training_days: int) -> float:
    mult = _ACTIVITY_MULT.get(activity_level, 1.55)
    # Extra overhead for resistance-training days beyond the activity multiplier
    return bmr * mult + training_days * 30


def _macros(calories: int, weight_kg: float, goal_type: str, scenario: str):
    protein_per_kg = _PROTEIN_MAP.get((goal_type, scenario), 2.0)
    protein_g = round(weight_kg * protein_per_kg)
    protein_cals = protein_g * 4

    # Fat: minimum 20 % of total calories for hormonal health
    fat_pct = 0.22 if calories < 2200 else 0.25
    fat_g = max(40, round(calories * fat_pct / 9))
    fat_cals = fat_g * 9

    # Carbs get the remainder (floor to avoid negative)
    carb_cals = max(0, calories - protein_cals - fat_cals)
    carbs_g = round(carb_cals / 4)

    return protein_g, carbs_g, fat_g


def _build_scenario(
    label: str,
    adj: int,
    tdee: float,
    weight_change_needed: float,
    goal_type: str,
    gender: str,
    weight_kg: float,
) -> dict:
    today = date.today()
    calories = round(tdee) + adj
    min_floor = 1500 if gender == "male" else 1200
    capped = False
    if calories < min_floor:
        calories = min_floor
        capped = True

    # Weekly rate from caloric adjustment (recomp treated as 0)
    if goal_type == "recomp":
        weekly_rate = 0.05  # body-comp change only, scale weight near zero
    else:
        weekly_rate = abs(adj) * 7 / _KCAL_PER_KG_LOSS

    weeks = abs(weight_change_needed) / weekly_rate if weekly_rate > 0 else 0
    if goal_type == "recomp":
        weeks = 12  # recomp is typically judged over 12 weeks

    target_date = (today + timedelta(days=round(weeks * 7))).isoformat()
    weekly_kg = -weekly_rate if goal_type in ("weight_loss", "recomp") else weekly_rate

    protein_g, carbs_g, fat_g = _macros(calories, weight_kg, goal_type, label)

    warnings: list[str] = []
    risk = "low"

    if capped:
        warnings.append("calories_capped_at_minimum")
        risk = "high"
    if weeks > 52:
        warnings.append("long_timeline")
        risk = max(risk, "medium", key=["low", "medium", "high"].index)  # type: ignore[call-overload]
    if label == "aggressive" and goal_type in ("weight_loss", "recomp"):
        warnings.append("muscle_loss_risk")
        risk = "medium" if risk == "low" else risk
    if label == "aggressive" and goal_type in ("weight_gain", "muscle_gain"):
        warnings.append("excess_fat_gain_risk")
        risk = "medium" if risk == "low" else risk

    return {
        "label": label,
        "weeks_to_goal": round(weeks, 1),
        "target_date": target_date,
        "weekly_change_kg": round(weekly_kg, 2),
        "daily_calories": calories,
        "caloric_adjustment": adj,
        "protein_g": protein_g,
        "carbs_g": carbs_g,
        "fat_g": fat_g,
        "risk_level": risk,
        "warnings": warnings,
    }


class PlannerInput(BaseModel):
    current_weight_kg: float = Field(..., ge=20, le=300)
    target_weight_kg: float = Field(..., ge=20, le=300)
    height_cm: float = Field(..., ge=100, le=250)
    age: int = Field(..., ge=16, le=100)
    gender: Literal["male", "female"]
    goal_type: Literal["weight_loss", "weight_gain", "recomp", "muscle_gain"]
    activity_level: Literal[
        "sedentary", "lightly_active", "moderately_active", "very_active", "extremely_active"
    ]
    training_frequency_per_week: int = Field(..., ge=0, le=7)


class ExplainInput(BaseModel):
    scenario: dict
    goal_type: str
    current_weight_kg: float
    target_weight_kg: float
    language: str = "tr"


@router.post("/plan")
def calculate_plan(
    body: PlannerInput,
    current_user: User = Depends(get_current_user),
):
    weight_change = body.target_weight_kg - body.current_weight_kg

    # Validate direction matches goal
    if body.goal_type in ("weight_loss", "recomp") and weight_change > 0:
        raise HTTPException(400, detail="Target weight must be below current weight for weight_loss/recomp")
    if body.goal_type in ("weight_gain", "muscle_gain") and weight_change < 0:
        raise HTTPException(400, detail="Target weight must be above current weight for weight_gain/muscle_gain")

    bmr = _bmr(body.current_weight_kg, body.height_cm, body.age, body.gender)
    tdee = _tdee(bmr, body.activity_level, body.training_frequency_per_week)

    configs = {
        "weight_loss": _LOSS_CONFIGS,
        "recomp": _RECOMP_CONFIGS,
        "weight_gain": _GAIN_CONFIGS,
        "muscle_gain": _GAIN_CONFIGS,
    }[body.goal_type]

    scenarios = [
        _build_scenario(
            label=label,
            adj=adj,
            tdee=tdee,
            weight_change_needed=weight_change,
            goal_type=body.goal_type,
            gender=body.gender,
            weight_kg=body.current_weight_kg,
        )
        for adj, label in configs
    ]

    return {
        "tdee": round(tdee),
        "bmr": round(bmr),
        "weight_change_needed_kg": round(weight_change, 1),
        "scenarios": scenarios,
    }


@router.post("/plan/explain")
async def explain_plan(
    body: ExplainInput,
    current_user: User = Depends(get_current_user),
):
    s = body.scenario
    lang_name = "Turkish" if body.language == "tr" else "English"

    prompt = (
        f"You are an evidence-based fitness and nutrition coach. "
        f"A user wants to {body.goal_type.replace('_', ' ')} from {body.current_weight_kg} kg to {body.target_weight_kg} kg.\n\n"
        f"The {s.get('label', '')} plan recommends:\n"
        f"- {s.get('daily_calories')} calories/day ({s.get('caloric_adjustment', 0):+d} kcal vs maintenance)\n"
        f"- {s.get('protein_g')}g protein · {s.get('carbs_g')}g carbs · {s.get('fat_g')}g fat\n"
        f"- Estimated {s.get('weeks_to_goal')} weeks ({s.get('target_date')})\n"
        f"- Expected {s.get('weekly_change_kg')} kg/week\n"
        f"- Risk level: {s.get('risk_level')}\n"
        f"- Warnings: {', '.join(s.get('warnings', [])) or 'none'}\n\n"
        f"Write 3 short paragraphs in {lang_name}:\n"
        f"1. Why this timeline is realistic (or what makes it challenging)\n"
        f"2. Why these macro targets support the goal\n"
        f"3. The 1-2 most important risks to monitor\n\n"
        f"Be concise, practical, and science-based. No bullet lists — flowing prose only."
    )

    fallback = (
        "This plan is calculated using the Mifflin-St Jeor equation for BMR and standard "
        "sports nutrition guidelines for protein and caloric targets. "
        "The timeline estimate is based on the caloric surplus or deficit applied consistently."
    )
    explanation = await call_gemini(prompt, prompt_type="goal_planner_explain", timeout_s=20.0, fallback=fallback)
    return {"explanation": explanation}
