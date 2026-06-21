import json
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.food_item import FoodItem
from app.models.meal_template import MealTemplate
from app.models.nutrition_log import FoodEntry, NutritionLog
from app.models.user import User

router = APIRouter(tags=["food-library"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class FoodItemCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=200)]
    brand: str | None = Field(None, max_length=100)
    calories_per_serving: Annotated[float, Field(ge=0, le=10000)] = 0
    protein_g_per_serving: Annotated[float, Field(ge=0, le=1000)] = 0
    carbs_g_per_serving: Annotated[float, Field(ge=0, le=2000)] = 0
    fat_g_per_serving: Annotated[float, Field(ge=0, le=1000)] = 0
    serving_size_g: Annotated[float | None, Field(None, ge=0, le=5000)] = None


class FoodItemUpdate(BaseModel):
    name: Annotated[str | None, Field(None, min_length=1, max_length=200)] = None
    brand: str | None = None
    calories_per_serving: Annotated[float | None, Field(None, ge=0, le=10000)] = None
    protein_g_per_serving: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    carbs_g_per_serving: Annotated[float | None, Field(None, ge=0, le=2000)] = None
    fat_g_per_serving: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    serving_size_g: Annotated[float | None, Field(None, ge=0, le=5000)] = None


class FoodItemResponse(BaseModel):
    id: int
    name: str
    brand: str | None
    calories_per_serving: float
    protein_g_per_serving: float
    carbs_g_per_serving: float
    fat_g_per_serving: float
    serving_size_g: float | None
    is_favorite: bool
    use_count: int
    last_used_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MealTemplateCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=200)]
    items: list[dict]


class MealTemplateResponse(BaseModel):
    id: int
    name: str
    items: list[dict]
    item_count: int
    total_calories: float
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateLogRequest(BaseModel):
    logged_date: date
    meal_type: Annotated[str, Field(pattern="^(breakfast|lunch|dinner|snack)$")]


# ── Food Items ────────────────────────────────────────────────────────────────

@router.get("/foods/recent", response_model=list[FoodItemResponse])
def get_recent_foods(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(FoodItem)
        .filter(FoodItem.user_id == current_user.id, FoodItem.last_used_at.isnot(None))
        .order_by(FoodItem.last_used_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/foods/favorites", response_model=list[FoodItemResponse])
def get_favorite_foods(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(FoodItem)
        .filter(FoodItem.user_id == current_user.id, FoodItem.is_favorite.is_(True))
        .order_by(FoodItem.name)
        .all()
    )


@router.get("/foods/analytics", response_model=list[FoodItemResponse])
def get_food_analytics(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(FoodItem)
        .filter(FoodItem.user_id == current_user.id, FoodItem.use_count > 0)
        .order_by(FoodItem.use_count.desc())
        .limit(limit)
        .all()
    )


@router.get("/foods", response_model=list[FoodItemResponse])
def list_foods(
    q: str | None = Query(None, max_length=100),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(FoodItem).filter(FoodItem.user_id == current_user.id)
    if q and q.strip():
        query = query.filter(func.lower(FoodItem.name).contains(q.strip().lower()))
    return query.order_by(FoodItem.name).limit(limit).all()


@router.post("/foods", response_model=FoodItemResponse, status_code=status.HTTP_201_CREATED)
def create_food(
    payload: FoodItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = FoodItem(
        user_id=current_user.id,
        created_at=datetime.now(timezone.utc),
        **payload.model_dump(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/foods/{food_id}", response_model=FoodItemResponse)
def update_food(
    food_id: int,
    payload: FoodItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(FoodItem).filter(FoodItem.id == food_id, FoodItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/foods/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food(
    food_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(FoodItem).filter(FoodItem.id == food_id, FoodItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
    db.delete(item)
    db.commit()


@router.post("/foods/{food_id}/favorite", response_model=FoodItemResponse)
def toggle_favorite(
    food_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(FoodItem).filter(FoodItem.id == food_id, FoodItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food not found")
    item.is_favorite = not item.is_favorite
    db.commit()
    db.refresh(item)
    return item


# ── Meal Templates ────────────────────────────────────────────────────────────

def _serialize_template(t: MealTemplate) -> dict:
    items = json.loads(t.items) if isinstance(t.items, str) else t.items
    total_cal = sum(i.get("calories", 0) or 0 for i in items)
    return {
        "id": t.id,
        "name": t.name,
        "items": items,
        "item_count": len(items),
        "total_calories": total_cal,
        "created_at": t.created_at,
    }


@router.get("/meal-templates")
def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    templates = (
        db.query(MealTemplate)
        .filter(MealTemplate.user_id == current_user.id)
        .order_by(MealTemplate.created_at.desc())
        .all()
    )
    return [_serialize_template(t) for t in templates]


@router.post("/meal-templates", status_code=status.HTTP_201_CREATED)
def create_template(
    payload: MealTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Template must have at least one item")
    t = MealTemplate(
        user_id=current_user.id,
        name=payload.name,
        items=json.dumps(payload.items, ensure_ascii=False),
        created_at=datetime.now(timezone.utc),
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _serialize_template(t)


@router.delete("/meal-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(MealTemplate).filter(MealTemplate.id == template_id, MealTemplate.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    db.delete(t)
    db.commit()


@router.post("/meal-templates/{template_id}/log", status_code=status.HTTP_201_CREATED)
def log_template(
    template_id: int,
    payload: TemplateLogRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    t = db.query(MealTemplate).filter(MealTemplate.id == template_id, MealTemplate.user_id == current_user.id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    items = json.loads(t.items) if isinstance(t.items, str) else t.items
    if not items:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Template has no items")

    # Find or create nutrition log for that date
    log = db.query(NutritionLog).filter(
        NutritionLog.user_id == current_user.id,
        NutritionLog.logged_date == payload.logged_date,
    ).first()
    if not log:
        log = NutritionLog(user_id=current_user.id, logged_date=payload.logged_date)
        db.add(log)
        db.flush()

    added = 0
    for item in items:
        entry = FoodEntry(
            nutrition_log_id=log.id,
            meal_type=payload.meal_type,
            food_name=item.get("food_name") or item.get("name", ""),
            quantity_g=item.get("quantity_g"),
            calories=item.get("calories"),
            protein_g=item.get("protein_g"),
            carbs_g=item.get("carbs_g"),
            fat_g=item.get("fat_g"),
            food_item_id=item.get("food_item_id"),
        )
        db.add(entry)
        # Increment use_count on linked food items
        if item.get("food_item_id"):
            fi = db.query(FoodItem).filter(
                FoodItem.id == item["food_item_id"],
                FoodItem.user_id == current_user.id,
            ).first()
            if fi:
                fi.use_count += 1
                fi.last_used_at = datetime.now(timezone.utc)
        added += 1

    db.commit()
    return {"added": added, "log_id": log.id}
