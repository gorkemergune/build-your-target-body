from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class HealthSyncLog(Base):
    __tablename__ = "health_sync_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # apple_health | health_connect | manual
    steps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    active_calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    resting_heart_rate_bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_heart_rate_bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_heart_rate_bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="health_sync_logs")  # noqa: F821
