from datetime import datetime

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
