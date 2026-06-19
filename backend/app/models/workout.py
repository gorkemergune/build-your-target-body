from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(nullable=True)

    user: Mapped["User"] = relationship(back_populates="workouts")  # noqa: F821
    exercises: Mapped[list["WorkoutExercise"]] = relationship(back_populates="workout", cascade="all, delete-orphan")


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workouts.id"), nullable=False, index=True)
    exercise_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sets: Mapped[int | None] = mapped_column(nullable=True)
    reps: Mapped[int | None] = mapped_column(nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    workout: Mapped["Workout"] = relationship(back_populates="exercises")
