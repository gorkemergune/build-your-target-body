from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AiScanLog(Base):
    __tablename__ = "ai_scan_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    photo_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_estimate: Mapped[str] = mapped_column(Text, nullable=False)
    food_count_ai: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_protein_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_carbs_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_fat_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_protein_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_carbs_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_fat_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    food_count_final: Mapped[int | None] = mapped_column(Integer, nullable=True)
    nutrition_log_id: Mapped[int | None] = mapped_column(
        ForeignKey("nutrition_logs.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    saved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="ai_scan_logs")  # noqa: F821
