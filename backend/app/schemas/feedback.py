from datetime import datetime

from pydantic import BaseModel, Field

FEEDBACK_TYPES = {"bug", "feature_request", "general_feedback"}


class FeedbackCreate(BaseModel):
    type: str = Field(..., description="bug | feature_request | general_feedback")
    message: str = Field(..., min_length=10, max_length=2000)

    def model_post_init(self, __context):
        if self.type not in FEEDBACK_TYPES:
            raise ValueError(f"type must be one of {FEEDBACK_TYPES}")


class FeedbackResponse(BaseModel):
    id: int
    type: str
    message: str
    created_at: datetime
    model_config = {"from_attributes": True}
