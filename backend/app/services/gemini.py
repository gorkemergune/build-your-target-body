from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.services.ai_context import build_user_context

_SYSTEM_PROMPT = """\
You are a personal fitness coach, nutrition advisor, and accountability partner.

STRICT RULES:
1. Only use the data in the USER DATA section below. Never invent, estimate, or guess numbers.
2. If the data is missing or insufficient to answer a question, say so clearly and explain what the user needs to log.
3. Respond in the language specified in the USER DATA (Turkish or English).
4. Be specific and reference actual numbers from the data. Be supportive and practical.
5. Keep responses focused and actionable (3–5 paragraphs max unless more detail is clearly needed).
6. Do not give medical or clinical advice. Focus on training, nutrition, and habit coaching.
7. If the user asks something unrelated to fitness, politely redirect to their goal.

USER DATA:
{context}
"""

_LEGACY_PROMPTS = {
    "nutrition": (
        "You are a certified nutritionist and dietitian. "
        "Provide specific, science-backed nutrition advice tailored to the user's body transformation goal. "
        "Be concise, practical, and supportive. Respond in the user's preferred language."
    ),
    "workout": (
        "You are an expert personal trainer. "
        "Provide effective workout advice aligned with the user's goal and fitness level. "
        "Respond in the user's preferred language."
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


def _get_model():
    import google.generativeai as genai  # lazy import

    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")


async def get_chat_response(user: User, message: str, db: Session) -> str:
    if not settings.GEMINI_API_KEY:
        return (
            "AI Coach is not configured. "
            "Please set the GEMINI_API_KEY environment variable to enable this feature."
        )

    context = build_user_context(user, db)
    system = _SYSTEM_PROMPT.format(context=context)
    full_prompt = f"{system}\n\nUser question: {message}"

    model = _get_model()
    response = model.generate_content(full_prompt)
    return response.text


async def get_ai_response(user: User, conversation_type: str, user_prompt: str, db: Session) -> str:
    """Legacy endpoint handler — kept for backward compatibility."""
    if not settings.GEMINI_API_KEY:
        return (
            "AI Coach is not configured. "
            "Please set the GEMINI_API_KEY environment variable to enable this feature."
        )

    context = build_user_context(user, db)
    system = _LEGACY_PROMPTS.get(conversation_type, "You are a helpful fitness assistant.")
    full_prompt = f"{system}\n\nUser context (use only this data):\n{context}\n\nUser question: {user_prompt}"

    model = _get_model()
    response = model.generate_content(full_prompt)
    return response.text
