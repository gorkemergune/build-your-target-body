from datetime import datetime

from pydantic import BaseModel


class DailyStepRecord(BaseModel):
    date: str  # YYYY-MM-DD
    steps: int
    source: str

    model_config = {"from_attributes": True}


class StepAnalytics(BaseModel):
    # Today
    today_steps: int | None
    today_goal: int
    today_pct: float  # 0-100
    remaining_today: int | None  # None if goal already met

    # This week (Mon–Sun)
    this_week_total: int
    this_week_avg_daily: float
    active_days_this_week: int

    # Last week comparison
    last_week_total: int
    week_over_week_pct: float | None  # e.g. +18.3 or -12.0

    # This month
    this_month_total: int

    # History
    daily_history: list[DailyStepRecord]  # last 30 days, newest first
    best_day: DailyStepRecord | None


ACHIEVEMENT_META: dict[str, dict] = {
    "daily_10k": {
        "title": "10K Day",
        "description": "Reached 10,000 steps in a single day",
        "icon": "footprints",
    },
    "weekly_50k": {
        "title": "50K Week",
        "description": "Accumulated 50,000 steps in a single week",
        "icon": "trending-up",
    },
    "monthly_100k": {
        "title": "100K Month",
        "description": "Reached 100,000 steps in a single month",
        "icon": "trophy",
    },
    "streak_3": {
        "title": "3-Day Streak",
        "description": "Hit the 10K step goal 3 days in a row",
        "icon": "flame",
    },
    "streak_7": {
        "title": "7-Day Streak",
        "description": "Hit the 10K step goal every day for a full week",
        "icon": "star",
    },
}


class StepAchievementResponse(BaseModel):
    key: str
    title: str
    description: str
    icon: str
    unlocked_at: datetime
    notes: str | None

    model_config = {"from_attributes": True}


class StepCoachingResponse(BaseModel):
    recommendation: str
    warning: str | None
    movement_goal: str
    coaching_source: str  # "ai" | "rule"
