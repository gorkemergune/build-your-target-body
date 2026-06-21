"""advanced workout logging

Revision ID: 0015
Revises: 0014
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extend workouts table
    op.add_column("workouts", sa.Column("workout_type", sa.String(50), nullable=False, server_default="strength"))
    op.add_column("workouts", sa.Column("calories_burned", sa.Float, nullable=True))
    op.add_column("workouts", sa.Column("distance_km", sa.Float, nullable=True))
    op.add_column("workouts", sa.Column("avg_heart_rate", sa.Integer, nullable=True))
    op.add_column("workouts", sa.Column("total_volume_kg", sa.Float, nullable=True))
    op.add_column("workouts", sa.Column("total_sets", sa.Integer, nullable=True))
    op.add_column("workouts", sa.Column("total_reps", sa.Integer, nullable=True))

    # Add order_index to workout_exercises
    op.add_column("workout_exercises", sa.Column("order_index", sa.Integer, nullable=False, server_default="0"))

    # New per-set table
    op.create_table(
        "workout_sets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("workout_exercise_id", sa.Integer, sa.ForeignKey("workout_exercises.id", ondelete="CASCADE"), nullable=False),
        sa.Column("set_number", sa.Integer, nullable=False),
        sa.Column("set_type", sa.String(20), nullable=False, server_default="working"),
        sa.Column("reps", sa.Integer, nullable=True),
        sa.Column("weight_kg", sa.Float, nullable=True),
        sa.Column("rpe", sa.Float, nullable=True),
        sa.Column("duration_seconds", sa.Integer, nullable=True),
        sa.Column("distance_km", sa.Float, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("ix_workout_sets_id", "workout_sets", ["id"])
    op.create_index("ix_workout_sets_exercise_id", "workout_sets", ["workout_exercise_id"])


def downgrade() -> None:
    op.drop_index("ix_workout_sets_exercise_id", "workout_sets")
    op.drop_index("ix_workout_sets_id", "workout_sets")
    op.drop_table("workout_sets")
    op.drop_column("workout_exercises", "order_index")
    op.drop_column("workouts", "total_reps")
    op.drop_column("workouts", "total_sets")
    op.drop_column("workouts", "total_volume_kg")
    op.drop_column("workouts", "avg_heart_rate")
    op.drop_column("workouts", "distance_km")
    op.drop_column("workouts", "calories_burned")
    op.drop_column("workouts", "workout_type")
