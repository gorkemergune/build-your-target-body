import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_db
from app.models.exercise import Exercise, ExerciseCategory, MuscleGroup
from app.models.user import User

router = APIRouter(tags=["exercises"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CategoryResponse(BaseModel):
    id: int
    name: str
    name_tr: str
    slug: str

    model_config = {"from_attributes": True}


class MuscleGroupResponse(BaseModel):
    id: int
    name: str
    name_tr: str
    slug: str

    model_config = {"from_attributes": True}


class ExerciseResponse(BaseModel):
    id: int
    name: str
    name_tr: str
    description: str | None
    category: CategoryResponse
    primary_muscle: MuscleGroupResponse
    secondary_muscles: list[str]
    equipment: str
    difficulty: str
    image_url: str | None

    model_config = {"from_attributes": True}


def _serialize_exercise(ex: Exercise) -> dict:
    secondary = []
    if ex.secondary_muscles:
        try:
            secondary = json.loads(ex.secondary_muscles)
        except (json.JSONDecodeError, TypeError):
            secondary = []
    return {
        "id": ex.id,
        "name": ex.name,
        "name_tr": ex.name_tr,
        "description": ex.description,
        "category": {
            "id": ex.category.id,
            "name": ex.category.name,
            "name_tr": ex.category.name_tr,
            "slug": ex.category.slug,
        },
        "primary_muscle": {
            "id": ex.primary_muscle.id,
            "name": ex.primary_muscle.name,
            "name_tr": ex.primary_muscle.name_tr,
            "slug": ex.primary_muscle.slug,
        },
        "secondary_muscles": secondary,
        "equipment": ex.equipment,
        "difficulty": ex.difficulty,
        "image_url": ex.image_url,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/exercises/categories", response_model=list[CategoryResponse])
def list_categories(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(ExerciseCategory).order_by(ExerciseCategory.name).all()


@router.get("/exercises/muscle-groups", response_model=list[MuscleGroupResponse])
def list_muscle_groups(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(MuscleGroup).order_by(MuscleGroup.name).all()


@router.get("/exercises")
def list_exercises(
    q: str | None = Query(None, max_length=100),
    category_id: int | None = Query(None),
    muscle_group_id: int | None = Query(None),
    limit: Annotated[int, Query(le=200)] = 50,
    offset: int = Query(0, ge=0),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Exercise)
        .options(joinedload(Exercise.category), joinedload(Exercise.primary_muscle))
    )
    if q and q.strip():
        term = q.strip().lower()
        query = query.filter(
            func.lower(Exercise.name).contains(term) | func.lower(Exercise.name_tr).contains(term)
        )
    if category_id:
        query = query.filter(Exercise.category_id == category_id)
    if muscle_group_id:
        query = query.filter(Exercise.primary_muscle_id == muscle_group_id)

    exercises = query.order_by(Exercise.name).offset(offset).limit(limit).all()
    return [_serialize_exercise(ex) for ex in exercises]


@router.get("/exercises/{exercise_id}")
def get_exercise(
    exercise_id: int,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ex = (
        db.query(Exercise)
        .options(joinedload(Exercise.category), joinedload(Exercise.primary_muscle))
        .filter(Exercise.id == exercise_id)
        .first()
    )
    if not ex:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return _serialize_exercise(ex)
