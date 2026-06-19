from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    goal_type: Mapped[str] = mapped_column(String(50), nullable=False)
    start_weight_kg: Mapped[float | None] = mapped_column(nullable=True)
    target_weight_kg: Mapped[float | None] = mapped_column(nullable=True)
    start_body_fat_pct: Mapped[float | None] = mapped_column(nullable=True)
    target_body_fat_pct: Mapped[float | None] = mapped_column(nullable=True)
    target_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="goals")  # noqa: F821
