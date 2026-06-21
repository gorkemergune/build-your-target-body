from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.health_sync import HealthSyncLog
from app.models.step_achievement import StepAchievement
from app.models.user import User
from app.schemas.steps import (
    ACHIEVEMENT_META,
    DailyStepRecord,
    StepAchievementResponse,
    StepAnalytics,
    StepCoachingResponse,
)
from app.services.gemini_client import call_gemini

router = APIRouter(prefix="/steps", tags=["steps"])

DEFAULT_STEP_GOAL = 10_000


def _week_bounds(d: date) -> tuple[date, date]:
    """Return Monday and Sunday of the week containing `d`."""
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _month_bounds(d: date) -> tuple[date, date]:
    """Return first and last day of the month containing `d`."""
    first = d.replace(day=1)
    if d.month == 12:
        last = d.replace(day=31)
    else:
        last = (d.replace(month=d.month + 1, day=1)) - timedelta(days=1)
    return first, last


@router.get("/analytics", response_model=StepAnalytics)
def step_analytics(
    goal: int = DEFAULT_STEP_GOAL,
    history_days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    cutoff = today - timedelta(days=history_days)
    week_start, week_end = _week_bounds(today)
    last_week_start = week_start - timedelta(days=7)
    last_week_end = week_start - timedelta(days=1)
    month_start, _ = _month_bounds(today)

    logs = (
        db.query(HealthSyncLog)
        .filter(
            HealthSyncLog.user_id == current_user.id,
            HealthSyncLog.log_date >= cutoff,
            HealthSyncLog.steps.isnot(None),
        )
        .order_by(HealthSyncLog.log_date.desc())
        .all()
    )

    by_date: dict[date, HealthSyncLog] = {l.log_date: l for l in logs}

    # Today
    today_log = by_date.get(today)
    today_steps = today_log.steps if today_log else None
    today_pct = min(100.0, round((today_steps / goal) * 100, 1)) if today_steps else 0.0
    remaining = max(0, goal - today_steps) if today_steps is not None else None

    # This week
    week_logs = [l for l in logs if week_start <= l.log_date <= week_end]
    this_week_total = sum(l.steps for l in week_logs if l.steps)
    active_days = sum(1 for l in week_logs if l.steps and l.steps > 0)
    this_week_avg = round(this_week_total / max(active_days, 1), 0)

    # Last week
    last_week_logs = [l for l in logs if last_week_start <= l.log_date <= last_week_end]
    last_week_total = sum(l.steps for l in last_week_logs if l.steps)
    wow_pct: float | None = None
    if last_week_total > 0:
        wow_pct = round(((this_week_total - last_week_total) / last_week_total) * 100, 1)

    # This month
    month_logs = [l for l in logs if l.log_date >= month_start]
    this_month_total = sum(l.steps for l in month_logs if l.steps)

    # History list
    daily_history = [
        DailyStepRecord(date=str(l.log_date), steps=l.steps, source=l.source)
        for l in logs
        if l.steps is not None
    ]

    # Best day
    best = max(daily_history, key=lambda r: r.steps) if daily_history else None

    return StepAnalytics(
        today_steps=today_steps,
        today_goal=goal,
        today_pct=today_pct,
        remaining_today=remaining,
        this_week_total=this_week_total,
        this_week_avg_daily=this_week_avg,
        active_days_this_week=active_days,
        last_week_total=last_week_total,
        week_over_week_pct=wow_pct,
        this_month_total=this_month_total,
        daily_history=daily_history,
        best_day=best,
    )


@router.get("/achievements", response_model=list[StepAchievementResponse])
def list_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(StepAchievement)
        .filter(StepAchievement.user_id == current_user.id)
        .order_by(StepAchievement.unlocked_at.desc())
        .all()
    )
    result = []
    for row in rows:
        meta = ACHIEVEMENT_META.get(row.achievement_key, {})
        result.append(
            StepAchievementResponse(
                key=row.achievement_key,
                title=meta.get("title", row.achievement_key),
                description=meta.get("description", ""),
                icon=meta.get("icon", "trophy"),
                unlocked_at=row.unlocked_at,
                notes=row.notes,
            )
        )
    return result


@router.post("/check-achievements", response_model=list[StepAchievementResponse])
def check_and_unlock_achievements(
    goal: int = DEFAULT_STEP_GOAL,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Evaluate health_sync_logs and unlock any new step achievements."""
    today = date.today()
    week_start, week_end = _week_bounds(today)
    last_30 = today - timedelta(days=30)
    month_start, _ = _month_bounds(today)

    logs = (
        db.query(HealthSyncLog)
        .filter(
            HealthSyncLog.user_id == current_user.id,
            HealthSyncLog.log_date >= last_30,
            HealthSyncLog.steps.isnot(None),
        )
        .order_by(HealthSyncLog.log_date.desc())
        .all()
    )

    existing_keys = {
        r.achievement_key
        for r in db.query(StepAchievement.achievement_key)
        .filter(StepAchievement.user_id == current_user.id)
        .all()
    }

    by_date = {l.log_date: l for l in logs}
    now = datetime.now(timezone.utc)
    newly_unlocked: list[StepAchievement] = []

    def _unlock(key: str, notes: str) -> None:
        if key not in existing_keys:
            a = StepAchievement(
                user_id=current_user.id,
                achievement_key=key,
                unlocked_at=now,
                notes=notes,
            )
            db.add(a)
            existing_keys.add(key)
            newly_unlocked.append(a)

    # daily_10k — any day ≥ 10k steps
    for log in logs:
        if log.steps and log.steps >= 10_000:
            _unlock("daily_10k", f"{log.steps:,} steps on {log.log_date}")
            break

    # weekly_50k
    week_total = sum(l.steps for l in logs if week_start <= l.log_date <= week_end and l.steps)
    if week_total >= 50_000:
        _unlock("weekly_50k", f"{week_total:,} steps this week")

    # monthly_100k
    month_total = sum(l.steps for l in logs if l.log_date >= month_start and l.steps)
    if month_total >= 100_000:
        _unlock("monthly_100k", f"{month_total:,} steps this month")

    # streak_3 and streak_7 — consecutive days hitting goal
    sorted_dates = sorted(by_date.keys(), reverse=True)
    streak = 0
    prev = today
    for d in sorted_dates:
        if (prev - d).days > 1:
            break
        if by_date[d].steps and by_date[d].steps >= goal:
            streak += 1
            prev = d
        else:
            break

    if streak >= 3:
        _unlock("streak_3", f"{streak}-day streak")
    if streak >= 7:
        _unlock("streak_7", f"{streak}-day streak")

    db.commit()

    result = []
    for a in newly_unlocked:
        db.refresh(a)
        meta = ACHIEVEMENT_META.get(a.achievement_key, {})
        result.append(
            StepAchievementResponse(
                key=a.achievement_key,
                title=meta.get("title", a.achievement_key),
                description=meta.get("description", ""),
                icon=meta.get("icon", "trophy"),
                unlocked_at=a.unlocked_at,
                notes=a.notes,
            )
        )
    return result


def _rule_based_coaching(analytics: StepAnalytics) -> StepCoachingResponse:
    today = analytics.today_steps or 0
    goal = analytics.today_goal
    remaining = analytics.remaining_today
    wow = analytics.week_over_week_pct

    if remaining is not None and remaining > 0:
        recommendation = f"You need {remaining:,} more steps to hit your {goal:,} daily target. A 15-minute walk adds ~1,500 steps."
    elif today >= goal:
        recommendation = f"Goal crushed! You've hit {today:,} steps today. Aim for {goal + 2000:,} tomorrow to keep momentum."
    else:
        recommendation = f"Start moving — even a short walk counts. Your target is {goal:,} steps."

    warning = None
    if wow is not None and wow < -15:
        warning = f"Your activity is {abs(wow):.0f}% lower than last week. Try to increase daily movement."

    if analytics.this_week_avg_daily < goal * 0.6:
        movement_goal = f"Aim for at least {int(goal * 0.8):,} steps every day this week to build consistency."
    elif analytics.this_week_avg_daily >= goal:
        movement_goal = f"Excellent weekly average of {int(analytics.this_week_avg_daily):,} steps. Push for a 7-day streak!"
    else:
        movement_goal = f"You're averaging {int(analytics.this_week_avg_daily):,} steps/day. Close the gap to {goal:,} with one extra walk."

    return StepCoachingResponse(
        recommendation=recommendation,
        warning=warning,
        movement_goal=movement_goal,
        coaching_source="rule",
    )


def _build_step_coaching_prompt(analytics: StepAnalytics, language: str) -> str:
    lang_instruction = "Respond in Turkish." if language == "tr" else "Respond in English."
    return f"""You are a fitness coach specializing in daily activity and step tracking.

User's step data:
- Today's steps: {analytics.today_steps or 0:,} / {analytics.today_goal:,} goal ({analytics.today_pct:.1f}%)
- Remaining today: {analytics.remaining_today or 0:,} steps
- This week total: {analytics.this_week_total:,} steps
- Weekly average: {analytics.this_week_avg_daily:,.0f} steps/day
- Active days this week: {analytics.active_days_this_week}/7
- vs Last week: {f"+{analytics.week_over_week_pct:.1f}%" if analytics.week_over_week_pct and analytics.week_over_week_pct > 0 else f"{analytics.week_over_week_pct:.1f}%" if analytics.week_over_week_pct else "no data"}
- This month total: {analytics.this_month_total:,} steps
- Best day ever: {analytics.best_day.steps:,} steps on {analytics.best_day.date} if analytics.best_day else "no data"

Generate a JSON response with exactly these three fields:
{{
  "recommendation": "<one motivational sentence about today's progress, under 80 chars>",
  "warning": "<one warning if activity is noticeably low, or null>",
  "movement_goal": "<one specific actionable goal sentence, under 90 chars>"
}}

{lang_instruction}
Keep all messages concise and personal. No markdown, just the JSON object."""


@router.get("/coaching", response_model=StepCoachingResponse)
async def step_coaching(
    goal: int = DEFAULT_STEP_GOAL,
    language: str = "en",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate AI-powered step coaching based on the user's step analytics."""
    analytics = step_analytics(goal=goal, history_days=30, current_user=current_user, db=db)

    prompt = _build_step_coaching_prompt(analytics, language)
    raw = await call_gemini(prompt, prompt_type="step_coaching", timeout_s=20.0, fallback="")

    if raw:
        import json, re
        try:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                return StepCoachingResponse(
                    recommendation=data.get("recommendation", ""),
                    warning=data.get("warning"),
                    movement_goal=data.get("movement_goal", ""),
                    coaching_source="ai",
                )
        except (json.JSONDecodeError, AttributeError):
            pass

    return _rule_based_coaching(analytics)
