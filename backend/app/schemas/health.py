from datetime import date, datetime

from pydantic import BaseModel, Field


class HealthSyncCreate(BaseModel):
    log_date: date
    source: str = Field(..., pattern="^(apple_health|health_connect|fitbit|garmin|manual)$")
    steps: int | None = Field(None, ge=0, le=200000)
    distance_km: float | None = Field(None, ge=0, le=500)
    active_calories: float | None = Field(None, ge=0, le=10000)
    resting_heart_rate_bpm: int | None = Field(None, ge=20, le=250)
    avg_heart_rate_bpm: int | None = Field(None, ge=20, le=250)
    max_heart_rate_bpm: int | None = Field(None, ge=20, le=250)


class HealthSyncResponse(BaseModel):
    id: int
    log_date: date
    source: str
    steps: int | None
    distance_km: float | None
    active_calories: float | None
    resting_heart_rate_bpm: int | None
    avg_heart_rate_bpm: int | None
    max_heart_rate_bpm: int | None
    synced_at: datetime

    model_config = {"from_attributes": True}


class HealthImportWorkoutRequest(BaseModel):
    name: str = Field(..., max_length=255)
    workout_type: str = Field(..., pattern="^(strength|cardio|running|cycling|pilates|crossfit|walking|other)$")
    logged_at: str
    duration_minutes: int | None = Field(None, ge=1, le=1440)
    active_calories: float | None = None
    distance_km: float | None = None
    avg_heart_rate_bpm: int | None = None
    source: str = Field(..., pattern="^(apple_health|health_connect|fitbit|garmin)$")


class HealthSummaryResponse(BaseModel):
    today: HealthSyncResponse | None = None
    last_sync_at: datetime | None = None
    source: str | None = None
    history: list[HealthSyncResponse] = []
