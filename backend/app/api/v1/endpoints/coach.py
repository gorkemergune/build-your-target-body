from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.coach_insight import CoachInsight
from app.models.user import User
from app.services.insight_engine import generate_insights_for_user

router = APIRouter(prefix="/coach", tags=["coach"])


@router.post("/generate", status_code=status.HTTP_200_OK)
async def generate(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_insights = await generate_insights_for_user(current_user, db)
    return {"generated": len(new_insights)}


@router.get("/insights")
def list_insights(
    include_dismissed: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(CoachInsight).filter(CoachInsight.user_id == current_user.id)
    if not include_dismissed:
        q = q.filter(CoachInsight.dismissed == False)  # noqa: E712
    insights = q.order_by(CoachInsight.created_at.desc()).limit(50).all()
    return [
        {
            "id": ins.id,
            "category": ins.category,
            "priority": ins.priority,
            "title": ins.title,
            "content": ins.content,
            "trigger_key": ins.trigger_key,
            "dismissed": ins.dismissed,
            "created_at": ins.created_at.isoformat(),
        }
        for ins in insights
    ]


@router.patch("/insights/{insight_id}/dismiss", status_code=status.HTTP_200_OK)
def dismiss(
    insight_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    insight = (
        db.query(CoachInsight)
        .filter(CoachInsight.id == insight_id, CoachInsight.user_id == current_user.id)
        .first()
    )
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found.")
    insight.dismissed = True
    db.commit()
    return {"ok": True}
