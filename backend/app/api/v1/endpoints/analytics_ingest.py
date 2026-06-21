"""Lightweight analytics ingestion — called fire-and-forget from the frontend."""
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.error_log import ErrorLog
from app.models.usage_event import UsageEvent
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics-ingest"])

_ALLOWED_TYPES = {
    "page_view",
    "feature_used",
    "session_start",
    "session_end",
}

_ALLOWED_FEATURES = {
    "weight_log",
    "workout_log",
    "nutrition_log",
    "photo_upload",
    "food_scan",
    "ai_chat",
    "report_generate",
    "coach_generate",
    "export_json",
    "export_csv",
    "export_backup",
    "import_data",
    "habit_complete",
}

_ALLOWED_ERROR_TYPES = {"frontend_error", "api_failure", "render_error"}

MAX_BATCH = 25
MAX_STR = 200


class EventIn(BaseModel):
    event_type: str = Field(..., max_length=50)
    event_name: str | None = Field(None, max_length=100)
    session_id: str | None = Field(None, max_length=36)
    properties: dict[str, Any] | None = None


class BatchIn(BaseModel):
    events: list[EventIn] = Field(..., max_length=MAX_BATCH)


class ErrorIn(BaseModel):
    error_type: str = Field(..., max_length=50)
    message: str = Field(..., max_length=2000)
    stack_trace: str | None = Field(None, max_length=5000)
    endpoint: str | None = Field(None, max_length=255)
    status_code: int | None = None


@router.post("/track", status_code=204)
def track_events(
    body: BatchIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = []
    for ev in body.events:
        if ev.event_type not in _ALLOWED_TYPES:
            continue
        if ev.event_type == "feature_used" and ev.event_name not in _ALLOWED_FEATURES:
            continue
        props_json = json.dumps(ev.properties) if ev.properties else None
        rows.append(
            UsageEvent(
                user_id=current_user.id,
                event_type=ev.event_type,
                event_name=ev.event_name,
                session_id=ev.session_id,
                properties=props_json,
            )
        )
    if rows:
        db.add_all(rows)
        db.commit()


@router.post("/error", status_code=204)
def log_error(
    body: ErrorIn,
    request: Request,
    db: Session = Depends(get_db),
):
    if body.error_type not in _ALLOWED_ERROR_TYPES:
        raise HTTPException(status_code=400, detail="Invalid error_type")

    # Try to get user from JWT without hard-failing
    user_id: int | None = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            from app.core.security import decode_token
            token = auth.split(" ", 1)[1]
            payload = decode_token(token)
            user_id = int(payload.get("sub", 0)) or None
        except Exception:
            pass

    db.add(
        ErrorLog(
            user_id=user_id,
            error_type=body.error_type,
            message=body.message[:2000],
            stack_trace=body.stack_trace,
            endpoint=body.endpoint,
            status_code=body.status_code,
        )
    )
    db.commit()
