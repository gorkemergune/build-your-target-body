from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.ai_conversation import AiConversation
from app.models.user import User
from app.schemas.ai import AiCoachRequest, AiCoachResponse
from app.services.gemini import get_ai_response

router = APIRouter(prefix="/ai", tags=["ai"])

VALID_TYPES = {"nutrition", "workout", "goal_analysis", "progress"}


@router.post("/coach", response_model=AiCoachResponse, status_code=status.HTTP_201_CREATED)
async def coach(
    payload: AiCoachRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.conversation_type not in VALID_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid conversation_type")

    ai_response = await get_ai_response(
        user=current_user,
        conversation_type=payload.conversation_type,
        user_prompt=payload.prompt,
        db=db,
    )

    record = AiConversation(
        user_id=current_user.id,
        conversation_type=payload.conversation_type,
        prompt=payload.prompt,
        response=ai_response,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/conversations", response_model=list[AiCoachResponse])
def list_conversations(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(AiConversation)
        .filter(AiConversation.user_id == current_user.id)
        .order_by(AiConversation.created_at.desc())
        .limit(limit)
        .all()
    )
