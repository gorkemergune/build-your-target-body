from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.ai_conversation import AiConversation
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.schemas.ai import AiChatRequest, AiChatResponse, AiCoachRequest, AiCoachResponse
from app.services.gemini import get_ai_response, get_chat_response

router = APIRouter(prefix="/ai", tags=["ai"])

VALID_TYPES = {"nutrition", "workout", "goal_analysis", "progress"}


@router.post("/chat", response_model=AiChatResponse, status_code=status.HTTP_201_CREATED)
async def chat(
    payload: AiChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ai_response = await get_chat_response(
        user=current_user,
        message=payload.message,
        db=db,
    )

    record = AiConversation(
        user_id=current_user.id,
        conversation_type="chat",
        prompt=payload.message,
        response=ai_response,
    )
    db.add(record)
    db.add(UsageEvent(user_id=current_user.id, event_type="ai_chat"))
    db.commit()
    db.refresh(record)
    return record


@router.get("/conversations", response_model=list[AiCoachResponse])
def list_conversations(
    limit: int = 50,
    type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AiConversation).filter(AiConversation.user_id == current_user.id)
    if type:
        q = q.filter(AiConversation.conversation_type == type)
    return q.order_by(AiConversation.created_at.asc()).limit(limit).all()


@router.delete("/conversations", status_code=status.HTTP_204_NO_CONTENT)
def clear_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(AiConversation).filter(AiConversation.user_id == current_user.id).delete()
    db.commit()


@router.post("/coach", response_model=AiCoachResponse, status_code=status.HTTP_201_CREATED)
async def coach(
    payload: AiCoachRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.conversation_type not in VALID_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid conversation_type",
        )

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
