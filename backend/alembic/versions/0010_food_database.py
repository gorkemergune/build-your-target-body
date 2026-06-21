"""add food_items and meal_templates

Revision ID: 0010
Revises: 0009
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "food_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("brand", sa.String(100), nullable=True),
        sa.Column("calories_per_serving", sa.Float, nullable=False, server_default="0"),
        sa.Column("protein_g_per_serving", sa.Float, nullable=False, server_default="0"),
        sa.Column("carbs_g_per_serving", sa.Float, nullable=False, server_default="0"),
        sa.Column("fat_g_per_serving", sa.Float, nullable=False, server_default="0"),
        sa.Column("serving_size_g", sa.Float, nullable=True),
        sa.Column("is_favorite", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("use_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_used_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_food_items_id", "food_items", ["id"])
    op.create_index("ix_food_items_user_id", "food_items", ["user_id"])

    op.create_table(
        "meal_templates",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("items", sa.Text, nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_meal_templates_id", "meal_templates", ["id"])
    op.create_index("ix_meal_templates_user_id", "meal_templates", ["user_id"])

    op.add_column(
        "food_entries",
        sa.Column(
            "food_item_id",
            sa.Integer,
            sa.ForeignKey("food_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("food_entries", "food_item_id")
    op.drop_index("ix_meal_templates_user_id", "meal_templates")
    op.drop_index("ix_meal_templates_id", "meal_templates")
    op.drop_table("meal_templates")
    op.drop_index("ix_food_items_user_id", "food_items")
    op.drop_index("ix_food_items_id", "food_items")
    op.drop_table("food_items")
