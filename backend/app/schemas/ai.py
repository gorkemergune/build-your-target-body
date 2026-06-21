from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AiCoachRequest(BaseModel):
    conversation_type: str
    prompt: str


class AiCoachResponse(BaseModel):
    id: int
    conversation_type: str
    prompt: str
    response: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AiChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class AiChatResponse(BaseModel):
    id: int
    prompt: str
    response: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateProgramRequest(BaseModel):
    goal: str = Field(..., pattern="^(weight_loss|muscle_gain|strength|recomposition)$")
    experience_level: str = Field(..., pattern="^(beginner|intermediate|advanced)$")
    training_days: int = Field(..., ge=2, le=6)
    equipment: list[str]
    template_type: str = Field(..., pattern="^(full_body|upper_lower|push_pull_legs|powerbuilding|strength|hypertrophy)$")
    language: str = Field(default="en", pattern="^(en|tr)$")


class WorkoutInsightsRequest(BaseModel):
    plateaus: list[dict]
    strength_trends: list[dict]
    consistency: dict
    strongest_lift: dict | None = None
    fastest_improving: dict | None = None
    language: str = Field(default="en", pattern="^(en|tr)$")


class SmartReminderRequest(BaseModel):
    reminder_types: list[str]
    language: str = Field(default="en", pattern="^(en|tr)$")
    calories_today: float | None = None
    protein_today_g: float | None = None
    protein_target_g: float | None = None
    workouts_this_week: int | None = None
    last_weight_kg: float | None = None
    goal_type: str | None = None
    goal_progress_pct: float | None = None
