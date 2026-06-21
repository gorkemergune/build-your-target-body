"""add habits and habit_logs

Revision ID: 0009
Revises: 0008
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "habits",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("icon", sa.String(10), nullable=True),
        sa.Column("target_frequency", sa.String(20), nullable=False, server_default="daily"),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_habits_id", "habits", ["id"])
    op.create_index("ix_habits_user_id", "habits", ["user_id"])
    op.create_index("ix_habits_user_active", "habits", ["user_id", "active"])

    op.create_table(
        "habit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("habit_id", sa.Integer, sa.ForeignKey("habits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed_date", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("habit_id", "completed_date", name="uq_habit_log_date"),
    )
    op.create_index("ix_habit_logs_id", "habit_logs", ["id"])
    op.create_index("ix_habit_logs_habit_id", "habit_logs", ["habit_id"])
    op.create_index("ix_habit_logs_user_date", "habit_logs", ["user_id", "completed_date"])


def downgrade() -> None:
    op.drop_index("ix_habit_logs_user_date", "habit_logs")
    op.drop_index("ix_habit_logs_habit_id", "habit_logs")
    op.drop_index("ix_habit_logs_id", "habit_logs")
    op.drop_table("habit_logs")
    op.drop_index("ix_habits_user_active", "habits")
    op.drop_index("ix_habits_user_id", "habits")
    op.drop_index("ix_habits_id", "habits")
    op.drop_table("habits")
