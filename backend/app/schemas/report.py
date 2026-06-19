from datetime import datetime

from pydantic import BaseModel


class ReportResponse(BaseModel):
    id: int
    type: str
    title: str
    content: str
    generated_at: datetime

    model_config = {"from_attributes": True}


class ReportSummary(BaseModel):
    id: int
    type: str
    title: str
    generated_at: datetime

    model_config = {"from_attributes": True}
