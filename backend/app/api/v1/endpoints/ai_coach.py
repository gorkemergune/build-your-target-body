import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.ai_conversation import AiConversation
from app.models.usage_event import UsageEvent
from app.models.user import User
from app.schemas.ai import AiChatRequest, AiChatResponse, AiCoachRequest, AiCoachResponse, GenerateProgramRequest, SmartReminderRequest, WorkoutInsightsRequest
from app.services.gemini import get_ai_response, get_chat_response
from app.services.gemini_client import call_gemini, GeminiQuotaError

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


# ── Workout Program Generator ─────────────────────────────────────────────────

_TEMPLATE_DESCRIPTIONS = {
    "full_body": "Full Body — train all major muscle groups every session",
    "upper_lower": "Upper/Lower Split — alternate upper and lower body days",
    "push_pull_legs": "Push/Pull/Legs — push muscles, pull muscles, leg days",
    "powerbuilding": "Powerbuilding — combine powerlifting compounds with hypertrophy accessories",
    "strength": "Strength Focused — heavy compound lifts, low reps, long rest",
    "hypertrophy": "Hypertrophy Focused — moderate weight, higher volume, muscle growth",
}

_GOAL_DESCRIPTIONS = {
    "weight_loss": "lose body fat while maintaining muscle",
    "muscle_gain": "maximize muscle hypertrophy and size",
    "strength": "increase maximal strength on compound lifts",
    "recomposition": "simultaneously lose fat and gain muscle",
}


def _build_program_prompt(req: GenerateProgramRequest) -> str:
    equipment_str = ", ".join(req.equipment) if req.equipment else "bodyweight only"
    lang_instruction = (
        "Write all text fields (program_name, overview, day_name, focus, notes, progression, "
        "progression_guidance, ai_explanation, expected_outcomes) in Turkish."
        if req.language == "tr"
        else "Write all text fields in English."
    )
    template_desc = _TEMPLATE_DESCRIPTIONS.get(req.template_type, req.template_type)
    goal_desc = _GOAL_DESCRIPTIONS.get(req.goal, req.goal)

    return f"""You are an expert strength and conditioning coach. Generate a complete, scientifically-sound training program.

Return ONLY a valid JSON object. No markdown code blocks. No explanation outside the JSON. Start your response with {{ and end with }}.

JSON schema (follow exactly):
{{
  "program_name": "string",
  "overview": "string (3-4 sentences describing the program)",
  "duration_weeks": number (8-16 weeks),
  "days": [
    {{
      "day_name": "string (e.g. 'Day 1 - Push' or 'Monday - Full Body A')",
      "focus": "string (primary muscle groups, e.g. 'Chest, Shoulders, Triceps')",
      "exercises": [
        {{
          "name": "string (exercise name in English)",
          "sets": number,
          "reps": "string (e.g. '3x8-10' or '5x5' or '4x12-15')",
          "rest_seconds": number,
          "notes": "string or null",
          "progression": "string (when/how to increase weight) or null"
        }}
      ]
    }}
  ],
  "progression_guidance": "string (2-3 sentences on weekly progression strategy)",
  "ai_explanation": "string (3-5 sentences explaining why these exercises were chosen)",
  "expected_outcomes": "string (what the user can expect after completing the program)"
}}

USER PROFILE:
- Goal: {goal_desc}
- Experience level: {req.experience_level}
- Training days per week: {req.training_days}
- Available equipment: {equipment_str}
- Program template: {template_desc}

RULES:
1. Generate exactly {req.training_days} training days (one entry per training day per week).
2. Only include exercises that can be performed with the available equipment.
3. Match volume and intensity to the experience level ({req.experience_level}).
4. Exercise names must always be in English regardless of language setting.
5. {lang_instruction}
6. Include 4-8 exercises per day for full body / PPL, 6-10 for upper/lower, 5-8 for strength/powerbuilding.
7. Rest periods: 60-90s for hypertrophy, 2-4min for strength, 30-60s for cardio-style.
8. Beginner: 3 sets, 8-12 reps. Intermediate: 4 sets, 6-12 reps. Advanced: 4-5 sets, 4-15 reps varied.
"""


def _extract_json(raw: str) -> dict:
    clean = raw.strip()
    # Strip markdown code fences
    clean = re.sub(r"^```(?:json)?\s*", "", clean)
    clean = re.sub(r"\s*```$", "", clean)
    clean = clean.strip()
    # Find first { to last }
    start = clean.find("{")
    end = clean.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in response")
    return json.loads(clean[start : end + 1])


@router.post("/generate-program")
async def generate_workout_program(
    payload: GenerateProgramRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = _build_program_prompt(payload)
    try:
        raw = await call_gemini(prompt, prompt_type="program_gen", timeout_s=60.0, fallback="", raise_on_rate_limit=True)
    except GeminiQuotaError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Günlük yapay zeka kotası doldu. Lütfen yarın tekrar deneyin veya Gemini planınızı yükseltin.",
        )

    if not raw:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI servisi şu an kullanılamıyor. GEMINI_API_KEY yapılandırmanızı kontrol edin.",
        )

    try:
        data = _extract_json(raw)
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("program_gen JSON parse failed: %s | raw_preview=%.300s", exc, raw)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI returned an unexpected response format. Please retry.",
        )

    return data


# ── Workout Intelligence AI Insights ─────────────────────────────────────────

def _build_insights_prompt(req: WorkoutInsightsRequest) -> str:
    lang = "Turkish" if req.language == "tr" else "English"
    lines = [
        f"You are an expert strength and conditioning coach. Analyze this athlete's workout data and provide actionable coaching feedback.",
        f"Respond in {lang}. Be specific, practical, and motivating. Structure your response in 3 sections:",
        "1. Progression Recommendations (what to focus on next)",
        "2. Recovery & Deload Suggestions (if needed)",
        "3. Performance Summary (key wins and areas for growth)",
        "",
        "WORKOUT DATA:",
    ]

    if req.strongest_lift:
        lines.append(f"- Strongest lift: {req.strongest_lift.get('exercise_name')} at {req.strongest_lift.get('weight_pr')}kg")

    if req.fastest_improving:
        lines.append(
            f"- Fastest improving: {req.fastest_improving.get('exercise_name')} "
            f"+{req.fastest_improving.get('growth_pct')}% over last 4 weeks"
        )

    cons = req.consistency
    lines.append(f"- Workouts last 12 weeks: {cons.get('total_workouts_12w', 0)} ({cons.get('avg_workouts_per_week', 0)} avg/week)")

    if req.strength_trends:
        lines.append("- Strength trends (recent vs prior 4 weeks):")
        for t in req.strength_trends[:5]:
            sign = "+" if t.get("growth_pct", 0) >= 0 else ""
            lines.append(f"  • {t['exercise_name']}: {sign}{t['growth_pct']}%")

    if req.plateaus:
        lines.append("- Detected stagnation:")
        for p in req.plateaus[:5]:
            lines.append(
                f"  • {p['exercise_name']}: {p['status']} for ~{p['weeks_stagnant']} weeks "
                f"(stuck at {p['last_weight']}kg)"
            )
    else:
        lines.append("- No plateaus detected — all lifts showing progression.")

    lines.append("")
    lines.append("Provide specific, named exercise recommendations and concrete strategies. Keep response to 300-400 words.")
    return "\n".join(lines)


@router.post("/workout-insights")
async def workout_insights(
    payload: WorkoutInsightsRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = _build_insights_prompt(payload)
    text = await call_gemini(prompt, prompt_type="workout_insights", timeout_s=45.0, fallback="")

    if not text:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is unavailable.",
        )

    return {"insights": text}


# ── Smart Notification Reminders ──────────────────────────────────────────────

_REMINDER_ROLE_HINTS = {
    "weight": "a motivating push to log daily weight",
    "workout": "an energizing workout call-to-action",
    "water": "a friendly hydration nudge",
    "protein": "a specific protein-intake reminder that can reference their numbers",
    "goal": "a goal-progress motivation boost",
}


def _build_smart_reminder_prompt(req: SmartReminderRequest) -> str:
    lang = "Turkish" if req.language == "tr" else "English"
    types_str = ", ".join(req.reminder_types)

    context_lines: list[str] = []
    if req.calories_today is not None:
        context_lines.append(f"- Calories today: {req.calories_today:.0f} kcal")
    if req.protein_today_g is not None and req.protein_target_g is not None:
        remaining = max(0, req.protein_target_g - req.protein_today_g)
        context_lines.append(
            f"- Protein: {req.protein_today_g:.0f}g consumed / {req.protein_target_g:.0f}g target "
            f"({remaining:.0f}g remaining)"
        )
    if req.workouts_this_week is not None:
        context_lines.append(f"- Workouts this week: {req.workouts_this_week}")
    if req.last_weight_kg is not None:
        context_lines.append(f"- Last logged weight: {req.last_weight_kg} kg")
    if req.goal_type:
        goal_label = {"weight_loss": "lose weight", "muscle_gain": "build muscle",
                      "strength": "gain strength", "recomposition": "body recomposition"}.get(req.goal_type, req.goal_type)
        context_lines.append(f"- Goal: {goal_label}")
    if req.goal_progress_pct is not None:
        context_lines.append(f"- Goal progress: {req.goal_progress_pct:.0f}%")

    context_block = "\n".join(context_lines) if context_lines else "No data available"

    type_hints = "\n".join(
        f'  "{t}": {_REMINDER_ROLE_HINTS.get(t, "a fitness reminder")}'
        for t in req.reminder_types
    )

    return f"""You are a motivational fitness coach writing push notification messages for a body transformation app.

Generate short, punchy notification messages for these reminder types: {types_str}

USER CONTEXT:
{context_block}

MESSAGE GUIDELINES:
- Max 70 characters per message
- Be specific when user data allows (e.g. "Only 105g protein left today!" instead of generic text)
- Tone: motivational, direct, friendly — never generic or boring
- Use 0-1 emoji per message
- Language: {lang}

Hint per type:
{type_hints}

Return ONLY a valid JSON object. No markdown. Start with {{ and end with }}.
Schema:
{{ {', '.join(f'"{t}": "message text"' for t in req.reminder_types)} }}"""


@router.post("/smart-reminders")
async def smart_reminders(
    payload: SmartReminderRequest,
    current_user: User = Depends(get_current_user),
):
    if not payload.reminder_types:
        return {}

    prompt = _build_smart_reminder_prompt(payload)
    raw = await call_gemini(prompt, prompt_type="smart_reminders", timeout_s=30.0, fallback="")

    if not raw:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is unavailable.",
        )

    try:
        data = _extract_json(raw)
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning("smart_reminders JSON parse failed: %s | raw_preview=%.200s", exc, raw)
        return {}  # client uses default reminder messages

    # Only return valid reminder type keys
    valid = {"weight", "workout", "water", "protein", "goal"}
    return {k: v for k, v in data.items() if k in valid and isinstance(v, str)}
