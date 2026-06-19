"""add ai_reports table

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_reports_id", "ai_reports", ["id"])
    op.create_index("ix_ai_reports_user_id", "ai_reports", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_reports_user_id", table_name="ai_reports")
    op.drop_index("ix_ai_reports_id", table_name="ai_reports")
    op.drop_table("ai_reports")
