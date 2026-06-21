"""health sync logs

Revision ID: 0016
Revises: 0015
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "health_sync_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("steps", sa.Integer(), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("active_calories", sa.Float(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_health_sync_logs_id", "health_sync_logs", ["id"])
    op.create_index("ix_health_sync_logs_user_id", "health_sync_logs", ["user_id"])
    op.create_index("ix_health_sync_logs_log_date", "health_sync_logs", ["log_date"])


def downgrade() -> None:
    op.drop_table("health_sync_logs")
