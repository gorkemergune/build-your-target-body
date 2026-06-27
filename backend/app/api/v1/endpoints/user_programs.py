from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.models.user_program import UserProgram, UserProgramDay, UserProgramExercise

router = APIRouter(prefix="/user-programs", tags=["user-programs"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProgramExerciseIn(BaseModel):
    exercise_name: str
    exercise_id: Optional[int] = None
    order_index: int = 0
    target_sets: Optional[int] = None
    target_reps: Optional[str] = None
    notes: Optional[str] = None


class ProgramDayIn(BaseModel):
    day_number: int
    name: str
    exercises: list[ProgramExerciseIn] = []


class ProgramCreate(BaseModel):
    name: str
    description: Optional[str] = None
    days: list[ProgramDayIn] = []


class ProgramExerciseOut(BaseModel):
    id: int
    exercise_name: str
    exercise_id: Optional[int]
    order_index: int
    target_sets: Optional[int]
    target_reps: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class ProgramDayOut(BaseModel):
    id: int
    day_number: int
    name: str
    exercises: list[ProgramExerciseOut]

    class Config:
        from_attributes = True


class ProgramOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    days: list[ProgramDayOut]

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_program(program_id: int, user_id: int, db: Session) -> UserProgram:
    prog = (
        db.query(UserProgram)
        .options(
            joinedload(UserProgram.days).joinedload(UserProgramDay.exercises)
        )
        .filter(UserProgram.id == program_id, UserProgram.user_id == user_id)
        .first()
    )
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return prog


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProgramOut])
def list_programs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(UserProgram)
        .options(joinedload(UserProgram.days).joinedload(UserProgramDay.exercises))
        .filter(UserProgram.user_id == current_user.id)
        .order_by(UserProgram.created_at.desc())
        .all()
    )


@router.post("", response_model=ProgramOut, status_code=status.HTTP_201_CREATED)
def create_program(
    payload: ProgramCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prog = UserProgram(
        user_id=current_user.id,
        name=payload.name.strip(),
        description=payload.description,
        created_at=datetime.now(timezone.utc),
    )
    db.add(prog)
    db.flush()

    for day_data in payload.days:
        day = UserProgramDay(
            program_id=prog.id,
            day_number=day_data.day_number,
            name=day_data.name.strip(),
        )
        db.add(day)
        db.flush()
        for ex_data in day_data.exercises:
            db.add(UserProgramExercise(
                day_id=day.id,
                exercise_name=ex_data.exercise_name.strip(),
                exercise_id=ex_data.exercise_id,
                order_index=ex_data.order_index,
                target_sets=ex_data.target_sets,
                target_reps=ex_data.target_reps,
                notes=ex_data.notes,
            ))

    db.commit()
    return _load_program(prog.id, current_user.id, db)


@router.get("/{program_id}", response_model=ProgramOut)
def get_program(
    program_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _load_program(program_id, current_user.id, db)


@router.put("/{program_id}", response_model=ProgramOut)
def update_program(
    program_id: int,
    payload: ProgramCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prog = db.query(UserProgram).filter(
        UserProgram.id == program_id, UserProgram.user_id == current_user.id
    ).first()
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    prog.name = payload.name.strip()
    prog.description = payload.description

    # Delete all days (cascade deletes exercises)
    db.query(UserProgramDay).filter(UserProgramDay.program_id == prog.id).delete()
    db.flush()

    for day_data in payload.days:
        day = UserProgramDay(
            program_id=prog.id,
            day_number=day_data.day_number,
            name=day_data.name.strip(),
        )
        db.add(day)
        db.flush()
        for ex_data in day_data.exercises:
            db.add(UserProgramExercise(
                day_id=day.id,
                exercise_name=ex_data.exercise_name.strip(),
                exercise_id=ex_data.exercise_id,
                order_index=ex_data.order_index,
                target_sets=ex_data.target_sets,
                target_reps=ex_data.target_reps,
                notes=ex_data.notes,
            ))

    db.commit()
    return _load_program(prog.id, current_user.id, db)


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_program(
    program_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prog = db.query(UserProgram).filter(
        UserProgram.id == program_id, UserProgram.user_id == current_user.id
    ).first()
    if not prog:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    db.delete(prog)
    db.commit()
