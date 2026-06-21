from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    gender: Mapped[str | None] = mapped_column(String(50), nullable=True)
    birth_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(nullable=True)
    activity_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(5), default="tr")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    goals: Mapped[list["Goal"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    weight_logs: Mapped[list["WeightLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    body_fat_logs: Mapped[list["BodyFatLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    measurement_logs: Mapped[list["MeasurementLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    nutrition_logs: Mapped[list["NutritionLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    workouts: Mapped[list["Workout"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    ai_conversations: Mapped[list["AiConversation"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    ai_reports: Mapped[list["AiReport"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    progress_photos: Mapped[list["ProgressPhoto"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    coach_insights: Mapped[list["CoachInsight"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    habits: Mapped[list["Habit"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    food_items: Mapped[list["FoodItem"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    meal_templates: Mapped[list["MealTemplate"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    barcode_scans: Mapped[list["BarcodeScan"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    ai_scan_logs: Mapped[list["AiScanLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    meal_plans: Mapped[list["MealPlan"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    health_sync_logs: Mapped[list["HealthSyncLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    wearable_connections: Mapped[list["WearableConnection"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
    step_achievements: Mapped[list["StepAchievement"]] = relationship(back_populates="user", cascade="all, delete-orphan")  # noqa: F821
