from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, Field


class WeightLogCreate(BaseModel):
    weight_kg: Annotated[float, Field(ge=20, le=500, description="Weight in kg (20-500)")]
    logged_at: datetime | None = None
    notes: str | None = Field(None, max_length=500)


class WeightLogResponse(BaseModel):
    id: int
    weight_kg: float
    logged_at: datetime
    notes: str | None

    model_config = {"from_attributes": True}


class BodyFatLogCreate(BaseModel):
    body_fat_pct: Annotated[float, Field(ge=1, le=70, description="Body fat percentage (1-70)")]
    logged_at: datetime | None = None
    notes: str | None = Field(None, max_length=500)


class BodyFatLogResponse(BaseModel):
    id: int
    body_fat_pct: float
    logged_at: datetime
    notes: str | None

    model_config = {"from_attributes": True}


_cm = Annotated[float | None, Field(None, ge=10, le=300, description="Measurement in cm (10-300)")]


class MeasurementCreate(BaseModel):
    logged_at: datetime | None = None
    chest_cm: _cm = None
    waist_cm: _cm = None
    hips_cm: _cm = None
    neck_cm: _cm = None
    left_arm_cm: _cm = None
    right_arm_cm: _cm = None
    left_thigh_cm: _cm = None
    right_thigh_cm: _cm = None


class MeasurementResponse(BaseModel):
    id: int
    logged_at: datetime
    chest_cm: float | None
    waist_cm: float | None
    hips_cm: float | None
    neck_cm: float | None
    left_arm_cm: float | None
    right_arm_cm: float | None
    left_thigh_cm: float | None
    right_thigh_cm: float | None

    model_config = {"from_attributes": True}


class FoodEntryCreate(BaseModel):
    meal_type: Annotated[str, Field(pattern="^(breakfast|lunch|dinner|snack)$")]
    food_name: Annotated[str, Field(min_length=1, max_length=255)]
    quantity_g: Annotated[float | None, Field(None, ge=0, le=5000)] = None
    calories: Annotated[float | None, Field(None, ge=0, le=10000)] = None
    protein_g: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    carbs_g: Annotated[float | None, Field(None, ge=0, le=2000)] = None
    fat_g: Annotated[float | None, Field(None, ge=0, le=1000)] = None


class FoodEntryResponse(BaseModel):
    id: int
    meal_type: str
    food_name: str
    quantity_g: float | None
    calories: float | None
    protein_g: float | None
    carbs_g: float | None
    fat_g: float | None

    model_config = {"from_attributes": True}


class NutritionLogCreate(BaseModel):
    logged_date: date
    total_calories: Annotated[float | None, Field(None, ge=0, le=20000)] = None
    protein_g: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    carbs_g: Annotated[float | None, Field(None, ge=0, le=2000)] = None
    fat_g: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    water_ml: Annotated[float | None, Field(None, ge=0, le=10000)] = None
    daily_notes: str | None = Field(None, max_length=2000)


class NutritionLogResponse(BaseModel):
    id: int
    logged_date: date
    total_calories: float | None
    protein_g: float | None
    carbs_g: float | None
    fat_g: float | None
    water_ml: float | None
    daily_notes: str | None
    food_entries: list[FoodEntryResponse] = []

    model_config = {"from_attributes": True}


class WorkoutExerciseCreate(BaseModel):
    exercise_name: Annotated[str, Field(min_length=1, max_length=255)]
    sets: Annotated[int | None, Field(None, ge=1, le=100)] = None
    reps: Annotated[int | None, Field(None, ge=1, le=1000)] = None
    weight_kg: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    duration_seconds: Annotated[int | None, Field(None, ge=1, le=86400)] = None
    notes: str | None = Field(None, max_length=500)


class WorkoutExerciseResponse(BaseModel):
    id: int
    exercise_name: str
    sets: int | None
    reps: int | None
    weight_kg: float | None
    duration_seconds: int | None
    notes: str | None

    model_config = {"from_attributes": True}


class WorkoutCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    logged_at: datetime | None = None
    notes: str | None = Field(None, max_length=1000)
    duration_minutes: Annotated[int | None, Field(None, ge=1, le=600)] = None
    exercises: list[WorkoutExerciseCreate] = []


class WorkoutResponse(BaseModel):
    id: int
    name: str
    logged_at: datetime
    notes: str | None
    duration_minutes: int | None
    exercises: list[WorkoutExerciseResponse] = []

    model_config = {"from_attributes": True}
