from datetime import datetime

from pydantic import BaseModel


class ProgressPhotoResponse(BaseModel):
    id: int
    image_path: str
    uploaded_at: datetime
    weight_kg: float | None
    body_fat_pct: float | None
    note: str | None

    model_config = {"from_attributes": True}
