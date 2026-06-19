"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Use VARCHAR for enum columns — avoids PostgreSQL ENUM type conflicts in Alembic.
# SQLAlchemy ORM models enforce valid values at the Python layer.
VARCHAR50 = sa.String(50)


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("gender", VARCHAR50, nullable=True),
        sa.Column("birth_date", sa.DateTime(), nullable=True),
        sa.Column("height_cm", sa.Float(), nullable=True),
        sa.Column("activity_level", VARCHAR50, nullable=True),
        sa.Column("preferred_language", sa.String(5), nullable=False, server_default="tr"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # --- goals ---
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("goal_type", VARCHAR50, nullable=False),
        sa.Column("start_weight_kg", sa.Float(), nullable=True),
        sa.Column("target_weight_kg", sa.Float(), nullable=True),
        sa.Column("start_body_fat_pct", sa.Float(), nullable=True),
        sa.Column("target_body_fat_pct", sa.Float(), nullable=True),
        sa.Column("target_date", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_goals_id", "goals", ["id"], unique=False)
    op.create_index("ix_goals_user_id", "goals", ["user_id"], unique=False)

    # --- weight_logs ---
    op.create_table(
        "weight_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("logged_at", sa.DateTime(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_weight_logs_id", "weight_logs", ["id"], unique=False)
    op.create_index("ix_weight_logs_user_id", "weight_logs", ["user_id"], unique=False)

    # --- body_fat_logs ---
    op.create_table(
        "body_fat_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("logged_at", sa.DateTime(), nullable=False),
        sa.Column("body_fat_pct", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_body_fat_logs_id", "body_fat_logs", ["id"], unique=False)
    op.create_index("ix_body_fat_logs_user_id", "body_fat_logs", ["user_id"], unique=False)

    # --- measurement_logs ---
    op.create_table(
        "measurement_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("logged_at", sa.DateTime(), nullable=False),
        sa.Column("chest_cm", sa.Float(), nullable=True),
        sa.Column("waist_cm", sa.Float(), nullable=True),
        sa.Column("hips_cm", sa.Float(), nullable=True),
        sa.Column("neck_cm", sa.Float(), nullable=True),
        sa.Column("left_arm_cm", sa.Float(), nullable=True),
        sa.Column("right_arm_cm", sa.Float(), nullable=True),
        sa.Column("left_thigh_cm", sa.Float(), nullable=True),
        sa.Column("right_thigh_cm", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_measurement_logs_id", "measurement_logs", ["id"], unique=False)
    op.create_index("ix_measurement_logs_user_id", "measurement_logs", ["user_id"], unique=False)

    # --- nutrition_logs ---
    op.create_table(
        "nutrition_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("logged_date", sa.Date(), nullable=False),
        sa.Column("total_calories", sa.Float(), nullable=True),
        sa.Column("protein_g", sa.Float(), nullable=True),
        sa.Column("carbs_g", sa.Float(), nullable=True),
        sa.Column("fat_g", sa.Float(), nullable=True),
        sa.Column("water_ml", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_nutrition_logs_id", "nutrition_logs", ["id"], unique=False)
    op.create_index("ix_nutrition_logs_user_id", "nutrition_logs", ["user_id"], unique=False)

    # --- food_entries ---
    op.create_table(
        "food_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nutrition_log_id", sa.Integer(), nullable=False),
        sa.Column("meal_type", VARCHAR50, nullable=False),
        sa.Column("food_name", sa.String(255), nullable=False),
        sa.Column("quantity_g", sa.Float(), nullable=True),
        sa.Column("calories", sa.Float(), nullable=True),
        sa.Column("protein_g", sa.Float(), nullable=True),
        sa.Column("carbs_g", sa.Float(), nullable=True),
        sa.Column("fat_g", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["nutrition_log_id"], ["nutrition_logs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_food_entries_id", "food_entries", ["id"], unique=False)
    op.create_index("ix_food_entries_nutrition_log_id", "food_entries", ["nutrition_log_id"], unique=False)

    # --- workouts ---
    op.create_table(
        "workouts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("logged_at", sa.DateTime(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workouts_id", "workouts", ["id"], unique=False)
    op.create_index("ix_workouts_user_id", "workouts", ["user_id"], unique=False)

    # --- workout_exercises ---
    op.create_table(
        "workout_exercises",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workout_id", sa.Integer(), nullable=False),
        sa.Column("exercise_name", sa.String(255), nullable=False),
        sa.Column("sets", sa.Integer(), nullable=True),
        sa.Column("reps", sa.Integer(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["workout_id"], ["workouts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workout_exercises_id", "workout_exercises", ["id"], unique=False)
    op.create_index("ix_workout_exercises_workout_id", "workout_exercises", ["workout_id"], unique=False)

    # --- ai_conversations ---
    op.create_table(
        "ai_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("conversation_type", VARCHAR50, nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("response", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_conversations_id", "ai_conversations", ["id"], unique=False)
    op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("ai_conversations")
    op.drop_table("workout_exercises")
    op.drop_table("workouts")
    op.drop_table("food_entries")
    op.drop_table("nutrition_logs")
    op.drop_table("measurement_logs")
    op.drop_table("body_fat_logs")
    op.drop_table("weight_logs")
    op.drop_table("goals")
    op.drop_table("users")
