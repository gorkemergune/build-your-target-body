from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NutritionLog(Base):
    __tablename__ = "nutrition_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    logged_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_calories: Mapped[float | None] = mapped_column(nullable=True)
    protein_g: Mapped[float | None] = mapped_column(nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(nullable=True)
    fat_g: Mapped[float | None] = mapped_column(nullable=True)
    water_ml: Mapped[float | None] = mapped_column(nullable=True)
    daily_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="nutrition_logs")  # noqa: F821
    food_entries: Mapped[list["FoodEntry"]] = relationship(back_populates="nutrition_log", cascade="all, delete-orphan")


class FoodEntry(Base):
    __tablename__ = "food_entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nutrition_log_id: Mapped[int] = mapped_column(ForeignKey("nutrition_logs.id"), nullable=False, index=True)
    meal_type: Mapped[str] = mapped_column(String(50), nullable=False)
    food_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity_g: Mapped[float | None] = mapped_column(nullable=True)
    calories: Mapped[float | None] = mapped_column(nullable=True)
    protein_g: Mapped[float | None] = mapped_column(nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(nullable=True)
    fat_g: Mapped[float | None] = mapped_column(nullable=True)

    nutrition_log: Mapped["NutritionLog"] = relationship(back_populates="food_entries")
