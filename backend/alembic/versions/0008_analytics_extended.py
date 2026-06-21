"""extend usage_events and add error_logs

Revision ID: 0008
Revises: 0007
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usage_events", sa.Column("event_name", sa.String(100), nullable=True))
    op.add_column("usage_events", sa.Column("properties", sa.Text, nullable=True))
    op.add_column("usage_events", sa.Column("session_id", sa.String(36), nullable=True))
    op.create_index("ix_usage_events_event_name", "usage_events", ["event_name"])
    op.create_index("ix_usage_events_session_id", "usage_events", ["session_id"])
    op.create_index("ix_usage_events_created_at", "usage_events", ["created_at"])

    op.create_table(
        "error_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("error_type", sa.String(50), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("stack_trace", sa.Text, nullable=True),
        sa.Column("endpoint", sa.String(255), nullable=True),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_error_logs_id", "error_logs", ["id"])
    op.create_index("ix_error_logs_user_id", "error_logs", ["user_id"])
    op.create_index("ix_error_logs_error_type", "error_logs", ["error_type"])
    op.create_index("ix_error_logs_created_at", "error_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_error_logs_created_at", "error_logs")
    op.drop_index("ix_error_logs_error_type", "error_logs")
    op.drop_index("ix_error_logs_user_id", "error_logs")
    op.drop_index("ix_error_logs_id", "error_logs")
    op.drop_table("error_logs")

    op.drop_index("ix_usage_events_created_at", "usage_events")
    op.drop_index("ix_usage_events_session_id", "usage_events")
    op.drop_index("ix_usage_events_event_name", "usage_events")
    op.drop_column("usage_events", "session_id")
    op.drop_column("usage_events", "properties")
    op.drop_column("usage_events", "event_name")
