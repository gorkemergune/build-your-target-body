from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FoodItem(Base):
    __tablename__ = "food_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    calories_per_serving: Mapped[float] = mapped_column(nullable=False, default=0.0)
    protein_g_per_serving: Mapped[float] = mapped_column(nullable=False, default=0.0)
    carbs_g_per_serving: Mapped[float] = mapped_column(nullable=False, default=0.0)
    fat_g_per_serving: Mapped[float] = mapped_column(nullable=False, default=0.0)
    serving_size_g: Mapped[float | None] = mapped_column(nullable=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    use_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped["User"] = relationship(back_populates="food_items")  # noqa: F821
