from datetime import datetime

from pydantic import BaseModel, Field

VALID_PLATFORMS = {"apple_watch", "garmin", "fitbit"}


class WearableConnectRequest(BaseModel):
    platform: str = Field(..., pattern="^(apple_watch|garmin|fitbit)$")
    display_name: str | None = None


class WearableFitbitExchangeRequest(BaseModel):
    code: str
    redirect_uri: str
    code_verifier: str | None = None  # PKCE


class WearableConnectionResponse(BaseModel):
    id: int
    platform: str
    is_connected: bool
    display_name: str | None
    last_sync_at: datetime | None
    connected_at: datetime

    model_config = {"from_attributes": True}


class ReadinessScore(BaseModel):
    score: int  # 0-100
    label: str  # "Peak" | "Good" | "Moderate" | "Low"
    factors: dict[str, int]  # factor_name → contribution
    advice: str


class RecoveryScore(BaseModel):
    score: int  # 0-100
    label: str
    days_since_workout: int | None
    weekly_workout_count: int
    advice: str


class WearableScoresResponse(BaseModel):
    readiness: ReadinessScore
    recovery: RecoveryScore
    computed_at: datetime
