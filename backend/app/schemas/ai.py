from datetime import datetime

from pydantic import BaseModel


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
