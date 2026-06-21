from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import exc as sa_exc
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.habit import Habit, HabitLog
from app.models.user import User

router = APIRouter(prefix="/habits", tags=["habits"])

# ── Default habits seeded for new users ──────────────────────────────

_DEFAULTS = [
    ("⚖️", "Log weight"),
    ("🥩", "Hit protein target"),
    ("💧", "Drink 3L water"),
    ("🏋️", "Complete workout"),
    ("😴", "Sleep 8 hours"),
]


def _seed_defaults(user_id: int, db: Session) -> None:
    for icon, title in _DEFAULTS:
        db.add(Habit(user_id=user_id, icon=icon, title=title, target_frequency="daily", active=True))
    db.commit()


# ── Streak helper ─────────────────────────────────────────────────────

def _streak(habit_id: int, db: Session) -> int:
    logs: set[date] = {
        row[0]
        for row in db.query(HabitLog.completed_date).filter(HabitLog.habit_id == habit_id).all()
    }
    if not logs:
        return 0
    today = date.today()
    check = today if today in logs else today - timedelta(days=1)
    count = 0
    while check in logs:
        count += 1
        check -= timedelta(days=1)
    return count


def _completed_dates(habit_id: int, days: int, db: Session) -> list[date]:
    cutoff = date.today() - timedelta(days=days)
    return [
        row[0]
        for row in db.query(HabitLog.completed_date)
        .filter(HabitLog.habit_id == habit_id, HabitLog.completed_date >= cutoff)
        .all()
    ]


def _habit_dict(h: Habit, today: date, db: Session) -> dict:
    completed_today = (
        db.query(HabitLog)
        .filter(HabitLog.habit_id == h.id, HabitLog.completed_date == today)
        .first()
    ) is not None
    streak = _streak(h.id, db)
    history = _completed_dates(h.id, 7, db)
    return {
        "id": h.id,
        "title": h.title,
        "icon": h.icon,
        "target_frequency": h.target_frequency,
        "active": h.active,
        "created_at": h.created_at.isoformat(),
        "completed_today": completed_today,
        "streak": streak,
        "history_7d": [d.isoformat() for d in history],
    }


# ── Schemas ───────────────────────────────────────────────────────────

class HabitCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    icon: str | None = Field(None, max_length=10)
    target_frequency: str = Field("daily", pattern="^(daily|weekly)$")


class HabitUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    icon: str | None = Field(None, max_length=10)
    active: bool | None = None


# ── Routes ────────────────────────────────────────────────────────────

@router.get("")
def list_habits(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    habits = (
        db.query(Habit)
        .filter(Habit.user_id == current_user.id)
        .order_by(Habit.created_at.asc())
        .all()
    )
    # Seed defaults if this user has never created any habits
    if not habits:
        _seed_defaults(current_user.id, db)
        habits = (
            db.query(Habit)
            .filter(Habit.user_id == current_user.id)
            .order_by(Habit.created_at.asc())
            .all()
        )
    today = date.today()
    return [_habit_dict(h, today, db) for h in habits]


@router.get("/daily-missions")
def daily_missions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active = (
        db.query(Habit)
        .filter(Habit.user_id == current_user.id, Habit.active == True)  # noqa: E712
        .order_by(Habit.id.asc())
        .all()
    )
    if not active:
        return {"missions": [], "completed": 0, "total": 0}

    today = date.today()

    # Deterministically pick up to 3 habits by rotating through active list
    n = len(active)
    if n <= 3:
        missions = active
    else:
        offset = today.toordinal() % n
        missions = [active[(offset + i) % n] for i in range(3)]

    result = []
    for h in missions:
        completed_today = (
            db.query(HabitLog)
            .filter(HabitLog.habit_id == h.id, HabitLog.completed_date == today)
            .first()
        ) is not None
        result.append({
            "id": h.id,
            "title": h.title,
            "icon": h.icon,
            "completed_today": completed_today,
            "streak": _streak(h.id, db),
        })

    total_completed = sum(1 for m in result if m["completed_today"])
    return {"missions": result, "completed": total_completed, "total": len(result)}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_habit(
    body: HabitCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = db.query(Habit).filter(Habit.user_id == current_user.id, Habit.active == True).count()  # noqa: E712
    if count >= 20:
        raise HTTPException(status_code=400, detail="Maximum 20 active habits allowed")
    h = Habit(
        user_id=current_user.id,
        title=body.title,
        icon=body.icon,
        target_frequency=body.target_frequency,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _habit_dict(h, date.today(), db)


@router.patch("/{habit_id}")
def update_habit(
    habit_id: int,
    body: HabitUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    h = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    if body.title is not None:
        h.title = body.title
    if body.icon is not None:
        h.icon = body.icon
    if body.active is not None:
        h.active = body.active
    db.commit()
    db.refresh(h)
    return _habit_dict(h, date.today(), db)


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    h = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    db.delete(h)
    db.commit()


@router.post("/{habit_id}/complete", status_code=status.HTTP_200_OK)
def complete_habit(
    habit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    h = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    today = date.today()
    existing = (
        db.query(HabitLog)
        .filter(HabitLog.habit_id == habit_id, HabitLog.completed_date == today)
        .first()
    )
    if not existing:
        try:
            db.add(HabitLog(habit_id=habit_id, user_id=current_user.id, completed_date=today))
            db.commit()
        except sa_exc.IntegrityError:
            db.rollback()  # race condition guard
    return {"streak": _streak(habit_id, db)}


@router.delete("/{habit_id}/complete", status_code=status.HTTP_200_OK)
def uncomplete_habit(
    habit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    h = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_user.id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Habit not found")
    today = date.today()
    log = (
        db.query(HabitLog)
        .filter(HabitLog.habit_id == habit_id, HabitLog.completed_date == today)
        .first()
    )
    if log:
        db.delete(log)
        db.commit()
    return {"streak": _streak(habit_id, db)}
