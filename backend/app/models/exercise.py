from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ExerciseCategory(Base):
    __tablename__ = "exercise_categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_tr: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    exercises: Mapped[list["Exercise"]] = relationship(back_populates="category")


class MuscleGroup(Base):
    __tablename__ = "muscle_groups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    name_tr: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)

    exercises_primary: Mapped[list["Exercise"]] = relationship(back_populates="primary_muscle")


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name_tr: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("exercise_categories.id"), nullable=False, index=True)
    primary_muscle_id: Mapped[int] = mapped_column(ForeignKey("muscle_groups.id"), nullable=False, index=True)
    secondary_muscles: Mapped[str | None] = mapped_column(Text, nullable=True)
    equipment: Mapped[str] = mapped_column(String(100), nullable=False, default="bodyweight")
    difficulty: Mapped[str] = mapped_column(String(50), nullable=False, default="beginner")
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    category: Mapped["ExerciseCategory"] = relationship(back_populates="exercises")
    primary_muscle: Mapped["MuscleGroup"] = relationship(back_populates="exercises_primary")
