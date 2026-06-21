from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BarcodeCache(Base):
    __tablename__ = "barcode_cache"

    barcode: Mapped[str] = mapped_column(String(20), primary_key=True)
    food_name: Mapped[str] = mapped_column(String(300), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(200), nullable=True)
    calories_per_100g: Mapped[float | None] = mapped_column(nullable=True)
    protein_g_per_100g: Mapped[float | None] = mapped_column(nullable=True)
    carbs_g_per_100g: Mapped[float | None] = mapped_column(nullable=True)
    fat_g_per_100g: Mapped[float | None] = mapped_column(nullable=True)
    serving_size_g: Mapped[float | None] = mapped_column(nullable=True)
    serving_size_desc: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="openfoodfacts")
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class BarcodeScan(Base):
    __tablename__ = "barcode_scans"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    barcode: Mapped[str] = mapped_column(String(20), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    scan_source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    user: Mapped["User"] = relationship(back_populates="barcode_scans")  # noqa: F821
