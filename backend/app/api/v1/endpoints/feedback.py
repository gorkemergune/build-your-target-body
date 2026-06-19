from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate, FeedbackResponse

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = Feedback(user_id=current_user.id, type=payload.type, message=payload.message)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/my", response_model=list[FeedbackResponse])
def my_feedback(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Feedback)
        .filter(Feedback.user_id == current_user.id)
        .order_by(Feedback.created_at.desc())
        .all()
    )
