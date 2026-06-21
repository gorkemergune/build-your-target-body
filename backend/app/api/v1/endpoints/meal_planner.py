"""
AI Meal Planner endpoint.

Generates structured meal plans via Gemini respecting the user's calorie/macro
targets from the nutrition engine.  Plans are persisted so users can revisit them.
"""
import json
import re
from datetime import datetime, timezone
from io import BytesIO
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.v1.endpoints.nutrition_targets import _compute_targets
from app.core.deps import get_current_user, get_db
from app.models.meal_plan import MealPlan
from app.models.user import User
from app.services.gemini_client import call_gemini

router = APIRouter(prefix="/meal-plans", tags=["meal-planner"])

_PLAN_TYPE_LABELS = {
    "cut": "caloric deficit (fat loss)",
    "bulk": "caloric surplus (muscle gain)",
    "recomp": "maintenance calories (body recomposition)",
    "maintenance": "maintenance calories",
}

_PREFERENCE_LABELS = {
    "vegetarian": "vegetarian (no meat or fish)",
    "high_protein": "high protein (prioritize protein-rich foods)",
    "budget": "budget-friendly (use affordable, everyday ingredients)",
}


def _resolve_calories(targets: dict, plan_type: str) -> tuple[int, int, int, int]:
    """Return (calories, protein_g, carbs_g, fat_g) for the requested plan type."""
    if plan_type == "cut":
        cal = targets.get("cutting", targets["target_calories"])
    elif plan_type == "bulk":
        cal = targets.get("bulking", targets["target_calories"])
    else:
        cal = targets.get("maintenance", targets["target_calories"])

    return (
        int(cal),
        int(targets["protein_g"]),
        int(targets["carbs_g"]),
        int(targets["fat_g"]),
    )


def _build_prompt(
    plan_type: str,
    duration_days: int,
    calories: int,
    protein_g: int,
    carbs_g: int,
    fat_g: int,
    weight_kg: float,
    goal_type: str | None,
    pref_labels: list[str],
) -> str:
    prefs = ", ".join(pref_labels) if pref_labels else "none"
    duration_label = f"{duration_days}-day" if duration_days > 1 else "1-day"
    goal_label = _PLAN_TYPE_LABELS.get(plan_type, plan_type)

    return f"""\
You are a professional nutritionist and meal planning expert.
Create a {duration_label} meal plan optimised for a {goal_label} goal.

User nutritional targets (daily):
- Calories: {calories} kcal
- Protein: {protein_g} g
- Carbohydrates: {carbs_g} g
- Fat: {fat_g} g
- Body weight: {weight_kg} kg
- Goal: {goal_type or plan_type}

Dietary preferences: {prefs}

Return ONLY a valid JSON object with this EXACT structure (no markdown, no code blocks):
{{
  "plan": {{
    "days": [
      {{
        "day": 1,
        "meals": [
          {{
            "meal_type": "breakfast",
            "name": "Descriptive meal name",
            "foods": [
              {{"name": "Food item", "amount": "100g", "calories": 200, "protein_g": 20, "carbs_g": 25, "fat_g": 8}}
            ],
            "total_calories": 200,
            "total_protein_g": 20,
            "total_carbs_g": 25,
            "total_fat_g": 8
          }}
        ],
        "total_calories": {calories},
        "total_protein_g": {protein_g},
        "total_carbs_g": {carbs_g},
        "total_fat_g": {fat_g}
      }}
    ]
  }},
  "shopping_list": {{
    "categories": [
      {{"category": "Proteins", "items": ["Chicken breast 800g", "Eggs 12 pack"]}},
      {{"category": "Grains & Carbs", "items": ["Rolled oats 500g"]}},
      {{"category": "Vegetables", "items": ["Broccoli 500g"]}},
      {{"category": "Fruits", "items": ["Banana 6 pack"]}},
      {{"category": "Dairy & Fats", "items": ["Greek yogurt 400g"]}},
      {{"category": "Other", "items": ["Olive oil 250ml"]}}
    ]
  }},
  "coach_notes": "One or two sentences explaining why this plan suits the user's goal and how it will help them progress."
}}

Rules:
1. Return ONLY raw JSON — no markdown, no code fences, no extra text.
2. Each day MUST have exactly 4 meals: breakfast, lunch, dinner, snack (in that order).
3. Daily totals must be within ±150 kcal of {calories} and within ±10 g of the protein target.
4. If vegetarian preference, avoid all meat, poultry, and fish.
5. Shopping list must consolidate all ingredients across ALL {duration_days} day(s).
6. Use realistic, commonly available foods with accurate macro values.
7. Round all numbers to the nearest integer.
"""


def _plan_to_markdown(plan_data: dict, plan_type: str, calories: int, protein_g: int, carbs_g: int, fat_g: int) -> str:
    lines = [
        f"## Daily Targets",
        f"Calories: {calories} kcal | Protein: {protein_g}g | Carbs: {carbs_g}g | Fat: {fat_g}g",
        "",
    ]
    for day in plan_data.get("days", []):
        lines.append(f"## Day {day['day']}")
        for meal in day.get("meals", []):
            lines.append(f"### {meal['meal_type'].title()} — {meal['name']}")
            for food in meal.get("foods", []):
                lines.append(f"- {food['name']} ({food['amount']}) — {food['calories']} kcal | P:{food['protein_g']}g C:{food['carbs_g']}g F:{food['fat_g']}g")
            lines.append(
                f"  **Meal total: {meal['total_calories']} kcal | P:{meal['total_protein_g']}g C:{meal['total_carbs_g']}g F:{meal['total_fat_g']}g**"
            )
            lines.append("")
        lines.append(
            f"**Day {day['day']} total: {day['total_calories']} kcal | P:{day['total_protein_g']}g C:{day['total_carbs_g']}g F:{day['total_fat_g']}g**"
        )
        lines.append("")
    return "\n".join(lines)


# ── Schemas ───────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    plan_type: Annotated[str, Field(pattern="^(cut|bulk|recomp|maintenance)$")]
    duration_days: Annotated[int, Field(ge=1, le=7)] = 7
    preferences: list[Literal["vegetarian", "high_protein", "budget"]] = []


class MealPlanSummary(BaseModel):
    id: int
    plan_type: str
    duration_days: int
    calorie_target: int | None
    protein_g_target: int | None
    carbs_g_target: int | None
    fat_g_target: int | None
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_meal_plan(
    payload: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    targets = _compute_targets(current_user, db)
    if not targets.get("complete"):
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Complete your profile to generate a meal plan.",
                "missing_fields": targets.get("missing_fields", []),
            },
        )

    calories, protein_g, carbs_g, fat_g = _resolve_calories(targets, payload.plan_type)
    pref_labels = [_PREFERENCE_LABELS[p] for p in payload.preferences if p in _PREFERENCE_LABELS]

    prompt = _build_prompt(
        plan_type=payload.plan_type,
        duration_days=payload.duration_days,
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        weight_kg=targets["weight_kg"],
        goal_type=targets.get("goal_type"),
        pref_labels=pref_labels,
    )

    raw = await call_gemini(prompt, prompt_type="meal_plan", timeout_s=60.0, fallback="")
    if not raw:
        raise HTTPException(status_code=503, detail="AI meal planner is unavailable. Please try again.")

    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw, flags=re.MULTILINE)

    try:
        gemini_data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned an unexpected format. Please try again.")

    plan_data = gemini_data.get("plan", {})
    shopping_data = gemini_data.get("shopping_list", {})
    coach_notes = str(gemini_data.get("coach_notes", "")).strip()[:2000]

    if not plan_data.get("days"):
        raise HTTPException(status_code=502, detail="AI returned an incomplete plan. Please try again.")

    meal_plan = MealPlan(
        user_id=current_user.id,
        plan_type=payload.plan_type,
        duration_days=payload.duration_days,
        preferences=json.dumps(payload.preferences, ensure_ascii=False) if payload.preferences else None,
        plan_content=json.dumps(plan_data, ensure_ascii=False),
        shopping_list=json.dumps(shopping_data, ensure_ascii=False) if shopping_data else None,
        ai_coach_notes=coach_notes or None,
        calorie_target=calories,
        protein_g_target=protein_g,
        carbs_g_target=carbs_g,
        fat_g_target=fat_g,
        created_at=datetime.now(timezone.utc),
    )
    db.add(meal_plan)
    db.commit()
    db.refresh(meal_plan)

    return _serialize_plan(meal_plan)


@router.get("")
def list_meal_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plans = (
        db.query(MealPlan)
        .filter(MealPlan.user_id == current_user.id)
        .order_by(MealPlan.created_at.desc())
        .limit(20)
        .all()
    )
    return [_serialize_plan(p) for p in plans]


@router.get("/{plan_id}")
def get_meal_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, current_user.id, db)
    return _serialize_plan(plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, current_user.id, db)
    db.delete(plan)
    db.commit()


@router.get("/{plan_id}/shopping-list")
def get_shopping_list(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = _get_plan_or_404(plan_id, current_user.id, db)
    if not plan.shopping_list:
        return {"categories": []}
    try:
        return json.loads(plan.shopping_list)
    except json.JSONDecodeError:
        return {"categories": []}


@router.get("/{plan_id}/export-pdf")
def export_meal_plan_pdf(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.pdf_generator import generate_pdf_bytes

    plan = _get_plan_or_404(plan_id, current_user.id, db)

    try:
        plan_data = json.loads(plan.plan_content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Plan data is corrupted.")

    type_labels = {"cut": "Fat Loss", "bulk": "Muscle Gain", "recomp": "Recomposition", "maintenance": "Maintenance"}
    title = f"{plan.duration_days}-Day {type_labels.get(plan.plan_type, plan.plan_type.title())} Meal Plan"

    content_md = _plan_to_markdown(
        plan_data,
        plan.plan_type,
        plan.calorie_target or 0,
        plan.protein_g_target or 0,
        plan.carbs_g_target or 0,
        plan.fat_g_target or 0,
    )

    if plan.ai_coach_notes:
        content_md += f"\n## Coach Notes\n{plan.ai_coach_notes}\n"

    if plan.shopping_list:
        try:
            sl = json.loads(plan.shopping_list)
            content_md += "\n## Shopping List\n"
            for cat in sl.get("categories", []):
                content_md += f"\n### {cat['category']}\n"
                for item in cat.get("items", []):
                    content_md += f"- {item}\n"
        except json.JSONDecodeError:
            pass

    pdf_bytes = generate_pdf_bytes(title, content_md, plan.created_at)

    safe_title = re.sub(r"[^\w\-]", "_", title)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.pdf"'},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_plan_or_404(plan_id: int, user_id: int, db: Session) -> MealPlan:
    plan = db.query(MealPlan).filter(
        MealPlan.id == plan_id, MealPlan.user_id == user_id
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found.")
    return plan


def _serialize_plan(plan: MealPlan) -> dict:
    try:
        plan_content = json.loads(plan.plan_content)
    except (json.JSONDecodeError, TypeError):
        plan_content = {}

    preferences: list[str] = []
    if plan.preferences:
        try:
            preferences = json.loads(plan.preferences)
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "id": plan.id,
        "plan_type": plan.plan_type,
        "duration_days": plan.duration_days,
        "preferences": preferences,
        "plan": plan_content,
        "ai_coach_notes": plan.ai_coach_notes,
        "calorie_target": plan.calorie_target,
        "protein_g_target": plan.protein_g_target,
        "carbs_g_target": plan.carbs_g_target,
        "fat_g_target": plan.fat_g_target,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
    }
