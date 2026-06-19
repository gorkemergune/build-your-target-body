from datetime import datetime

from pydantic import BaseModel


class GoalCreate(BaseModel):
    goal_type: str
    start_weight_kg: float | None = None
    target_weight_kg: float | None = None
    start_body_fat_pct: float | None = None
    target_body_fat_pct: float | None = None
    target_date: datetime | None = None


class GoalResponse(BaseModel):
    id: int
    goal_type: str
    start_weight_kg: float | None
    target_weight_kg: float | None
    start_body_fat_pct: float | None
    target_body_fat_pct: float | None
    target_date: datetime | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
