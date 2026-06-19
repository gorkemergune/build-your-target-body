from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.goal import Goal
from app.models.user import User
from app.models.weight_log import WeightLog

_SYSTEM_PROMPTS = {
    "nutrition": (
        "You are a certified nutritionist and dietitian. "
        "Provide specific, science-backed nutrition advice tailored to the user's body transformation goal. "
        "Be concise, practical, and supportive. Respond in the user's preferred language."
    ),
    "workout": (
        "You are an expert personal trainer. "
        "Provide effective workout advice aligned with the user's goal and fitness level. "
        "Include sets, reps, and rest times when relevant. Respond in the user's preferred language."
    ),
    "goal_analysis": (
        "You are a body transformation coach. "
        "Analyze the user's progress toward their goal and provide realistic, motivating feedback. "
        "Respond in the user's preferred language."
    ),
    "progress": (
        "You are a data-driven fitness analyst. "
        "Analyze the user's tracking data and identify trends, risks, and opportunities. "
        "Respond in the user's preferred language."
    ),
}


async def get_ai_response(user: User, conversation_type: str, user_prompt: str, db: Session) -> str:
    if not settings.GEMINI_API_KEY:
        return (
            "AI Coach is not configured. Please set the GEMINI_API_KEY environment variable to enable this feature."
        )

    import google.generativeai as genai  # lazy import — only when key is present

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")

    system = _SYSTEM_PROMPTS.get(conversation_type, "You are a helpful fitness assistant.")

    active_goal = db.query(Goal).filter(Goal.user_id == user.id, Goal.is_active == True).first()  # noqa: E712
    latest_weight = (
        db.query(WeightLog).filter(WeightLog.user_id == user.id).order_by(WeightLog.logged_at.desc()).first()
    )

    context_parts = [f"User: {user.full_name}"]
    if user.height_cm:
        context_parts.append(f"Height: {user.height_cm}cm")
    if latest_weight:
        context_parts.append(f"Current weight: {latest_weight.weight_kg}kg")
    if active_goal:
        context_parts.append(f"Goal: {active_goal.goal_type}")
        if active_goal.target_weight_kg:
            context_parts.append(f"Target weight: {active_goal.target_weight_kg}kg")
        if active_goal.target_date:
            context_parts.append(f"Target date: {active_goal.target_date.date().isoformat()}")

    context = " | ".join(context_parts)
    full_prompt = f"{system}\n\nUser context: {context}\n\nUser question: {user_prompt}"

    response = model.generate_content(full_prompt)
    return response.text
