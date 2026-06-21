from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_type: Mapped[str] = mapped_column(String(50), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    preferences: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_content: Mapped[str] = mapped_column(Text, nullable=False)
    shopping_list: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_coach_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    calorie_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    protein_g_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    carbs_g_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fat_g_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="meal_plans")  # noqa: F821
