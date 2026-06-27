"""user workout programs

Revision ID: 0021
Revises: 0020
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_programs",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "user_program_days",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("program_id", sa.Integer, sa.ForeignKey("user_programs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("day_number", sa.Integer, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
    )

    op.create_table(
        "user_program_exercises",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("day_id", sa.Integer, sa.ForeignKey("user_program_days.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("exercise_name", sa.String(200), nullable=False),
        sa.Column("exercise_id", sa.Integer, sa.ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("target_sets", sa.Integer, nullable=True),
        sa.Column("target_reps", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("user_program_exercises")
    op.drop_table("user_program_days")
    op.drop_table("user_programs")
