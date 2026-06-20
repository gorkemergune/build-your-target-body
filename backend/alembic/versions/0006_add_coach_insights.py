"""add coach insights

Revision ID: 0006
Revises: 0005
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "coach_insights",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("trigger_key", sa.String(100), nullable=False),
        sa.Column("dismissed", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_coach_insights_id", "coach_insights", ["id"])
    op.create_index("ix_coach_insights_user_id", "coach_insights", ["user_id"])
    op.create_index("ix_coach_insights_trigger_key", "coach_insights", ["trigger_key"])


def downgrade() -> None:
    op.drop_index("ix_coach_insights_trigger_key", "coach_insights")
    op.drop_index("ix_coach_insights_user_id", "coach_insights")
    op.drop_index("ix_coach_insights_id", "coach_insights")
    op.drop_table("coach_insights")
