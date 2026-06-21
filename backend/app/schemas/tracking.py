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
    food_item_id: int | None = None


class FoodEntryResponse(BaseModel):
    id: int
    meal_type: str
    food_name: str
    quantity_g: float | None
    calories: float | None
    protein_g: float | None
    carbs_g: float | None
    fat_g: float | None
    food_item_id: int | None

    model_config = {"from_attributes": True}


class NutritionLogCreate(BaseModel):
    logged_date: date
    total_calories: Annotated[float | None, Field(None, ge=0, le=20000)] = None
    protein_g: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    carbs_g: Annotated[float | None, Field(None, ge=0, le=2000)] = None
    fat_g: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    water_ml: Annotated[float | None, Field(None, ge=0, le=10000)] = None
    daily_notes: str | None = Field(None, max_length=2000)
    photo_path: str | None = Field(None, max_length=255)


class NutritionLogResponse(BaseModel):
    id: int
    logged_date: date
    total_calories: float | None
    protein_g: float | None
    carbs_g: float | None
    fat_g: float | None
    water_ml: float | None
    daily_notes: str | None
    photo_path: str | None = None
    food_entries: list[FoodEntryResponse] = []

    model_config = {"from_attributes": True}


class WorkoutSetCreate(BaseModel):
    set_number: Annotated[int, Field(ge=1, le=100)]
    set_type: Annotated[str, Field(pattern="^(warmup|working)$")] = "working"
    reps: Annotated[int | None, Field(None, ge=1, le=10000)] = None
    weight_kg: Annotated[float | None, Field(None, ge=0, le=2000)] = None
    rpe: Annotated[float | None, Field(None, ge=1, le=10)] = None
    duration_seconds: Annotated[int | None, Field(None, ge=1, le=86400)] = None
    distance_km: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    notes: str | None = Field(None, max_length=300)


class WorkoutSetResponse(BaseModel):
    id: int
    set_number: int
    set_type: str
    reps: int | None
    weight_kg: float | None
    rpe: float | None
    duration_seconds: int | None
    distance_km: float | None
    notes: str | None

    model_config = {"from_attributes": True}


class WorkoutExerciseCreate(BaseModel):
    exercise_name: Annotated[str, Field(min_length=1, max_length=255)]
    exercise_id: int | None = None
    order_index: int = 0
    notes: str | None = Field(None, max_length=500)
    sets_data: list[WorkoutSetCreate] = []
    # Legacy fields — still accepted for backward compat
    sets: Annotated[int | None, Field(None, ge=1, le=100)] = None
    reps: Annotated[int | None, Field(None, ge=1, le=1000)] = None
    weight_kg: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    duration_seconds: Annotated[int | None, Field(None, ge=1, le=86400)] = None


class WorkoutExerciseResponse(BaseModel):
    id: int
    exercise_name: str
    exercise_id: int | None
    order_index: int
    notes: str | None
    sets: int | None
    reps: int | None
    weight_kg: float | None
    duration_seconds: int | None
    workout_sets: list[WorkoutSetResponse] = []

    model_config = {"from_attributes": True}


_WORKOUT_TYPE = Annotated[str, Field(pattern="^(strength|cardio|running|cycling|pilates|crossfit)$")]


class WorkoutCreate(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    logged_at: datetime | None = None
    notes: str | None = Field(None, max_length=1000)
    duration_minutes: Annotated[int | None, Field(None, ge=1, le=1440)] = None
    workout_type: _WORKOUT_TYPE = "strength"
    calories_burned: Annotated[float | None, Field(None, ge=0, le=10000)] = None
    distance_km: Annotated[float | None, Field(None, ge=0, le=1000)] = None
    avg_heart_rate: Annotated[int | None, Field(None, ge=30, le=250)] = None
    exercises: list[WorkoutExerciseCreate] = []


class WorkoutResponse(BaseModel):
    id: int
    name: str
    logged_at: datetime
    workout_type: str
    notes: str | None
    duration_minutes: int | None
    calories_burned: float | None
    distance_km: float | None
    avg_heart_rate: int | None
    total_volume_kg: float | None
    total_sets: int | None
    total_reps: int | None
    exercises: list[WorkoutExerciseResponse] = []

    model_config = {"from_attributes": True}
