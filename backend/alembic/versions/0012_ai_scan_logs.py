"""add ai_scan_logs

Revision ID: 0012
Revises: 0011
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_scan_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("photo_token", sa.String(255), nullable=True),
        sa.Column("ai_estimate", sa.Text, nullable=False),          # full Gemini JSON response
        sa.Column("food_count_ai", sa.Integer, nullable=False, server_default="0"),
        sa.Column("ai_calories", sa.Float, nullable=True),
        sa.Column("ai_protein_g", sa.Float, nullable=True),
        sa.Column("ai_carbs_g", sa.Float, nullable=True),
        sa.Column("ai_fat_g", sa.Float, nullable=True),
        sa.Column("final_calories", sa.Float, nullable=True),       # user-adjusted totals
        sa.Column("final_protein_g", sa.Float, nullable=True),
        sa.Column("final_carbs_g", sa.Float, nullable=True),
        sa.Column("final_fat_g", sa.Float, nullable=True),
        sa.Column("food_count_final", sa.Integer, nullable=True),
        sa.Column(
            "nutrition_log_id",
            sa.Integer,
            sa.ForeignKey("nutrition_logs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("saved_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_ai_scan_logs_id", "ai_scan_logs", ["id"])
    op.create_index("ix_ai_scan_logs_user_id", "ai_scan_logs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_scan_logs_user_id", "ai_scan_logs")
    op.drop_index("ix_ai_scan_logs_id", "ai_scan_logs")
    op.drop_table("ai_scan_logs")
