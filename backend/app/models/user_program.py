from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserProgram(Base):
    __tablename__ = "user_programs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="programs")  # noqa: F821
    days: Mapped[list["UserProgramDay"]] = relationship(
        back_populates="program",
        cascade="all, delete-orphan",
        order_by="UserProgramDay.day_number",
    )


class UserProgramDay(Base):
    __tablename__ = "user_program_days"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("user_programs.id"), nullable=False, index=True)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    program: Mapped["UserProgram"] = relationship(back_populates="days")
    exercises: Mapped[list["UserProgramExercise"]] = relationship(
        back_populates="day",
        cascade="all, delete-orphan",
        order_by="UserProgramExercise.order_index",
    )


class UserProgramExercise(Base):
    __tablename__ = "user_program_exercises"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("user_program_days.id"), nullable=False, index=True)
    exercise_name: Mapped[str] = mapped_column(String(200), nullable=False)
    exercise_id: Mapped[int | None] = mapped_column(
        ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    target_sets: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_reps: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    day: Mapped["UserProgramDay"] = relationship(back_populates="exercises")
