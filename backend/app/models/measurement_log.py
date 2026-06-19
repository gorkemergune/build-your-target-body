from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MeasurementLog(Base):
    __tablename__ = "measurement_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    chest_cm: Mapped[float | None] = mapped_column(nullable=True)
    waist_cm: Mapped[float | None] = mapped_column(nullable=True)
    hips_cm: Mapped[float | None] = mapped_column(nullable=True)
    neck_cm: Mapped[float | None] = mapped_column(nullable=True)
    left_arm_cm: Mapped[float | None] = mapped_column(nullable=True)
    right_arm_cm: Mapped[float | None] = mapped_column(nullable=True)
    left_thigh_cm: Mapped[float | None] = mapped_column(nullable=True)
    right_thigh_cm: Mapped[float | None] = mapped_column(nullable=True)

    user: Mapped["User"] = relationship(back_populates="measurement_logs")  # noqa: F821
