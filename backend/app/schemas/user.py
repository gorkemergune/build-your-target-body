from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    gender: str | None
    height_cm: float | None
    activity_level: str | None
    preferred_language: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    gender: str | None = None
    birth_date: datetime | None = None
    height_cm: float | None = None
    activity_level: str | None = None
    preferred_language: str | None = None
