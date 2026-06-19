"""add feedback and usage events

Revision ID: 0005
Revises: 0004
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_feedback_id", "feedback", ["id"])
    op.create_index("ix_feedback_user_id", "feedback", ["user_id"])

    op.create_table(
        "usage_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_usage_events_id", "usage_events", ["id"])
    op.create_index("ix_usage_events_user_id", "usage_events", ["user_id"])
    op.create_index("ix_usage_events_event_type", "usage_events", ["event_type"])


def downgrade() -> None:
    op.drop_index("ix_usage_events_event_type", "usage_events")
    op.drop_index("ix_usage_events_user_id", "usage_events")
    op.drop_index("ix_usage_events_id", "usage_events")
    op.drop_table("usage_events")
    op.drop_index("ix_feedback_user_id", "feedback")
    op.drop_index("ix_feedback_id", "feedback")
    op.drop_table("feedback")
