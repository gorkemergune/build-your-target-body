"""add meal_plans

Revision ID: 0013
Revises: 0012
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "meal_plans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("plan_type", sa.String(50), nullable=False),
        sa.Column("duration_days", sa.Integer, nullable=False, server_default="7"),
        sa.Column("preferences", sa.Text, nullable=True),
        sa.Column("plan_content", sa.Text, nullable=False),
        sa.Column("shopping_list", sa.Text, nullable=True),
        sa.Column("ai_coach_notes", sa.Text, nullable=True),
        sa.Column("calorie_target", sa.Integer, nullable=True),
        sa.Column("protein_g_target", sa.Integer, nullable=True),
        sa.Column("carbs_g_target", sa.Integer, nullable=True),
        sa.Column("fat_g_target", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_meal_plans_id", "meal_plans", ["id"])
    op.create_index("ix_meal_plans_user_id", "meal_plans", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_meal_plans_user_id", "meal_plans")
    op.drop_index("ix_meal_plans_id", "meal_plans")
    op.drop_table("meal_plans")
