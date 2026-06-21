"""step achievements table

Revision ID: 0018
Revises: 0017
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "step_achievements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("achievement_key", sa.String(100), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(), nullable=False),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_step_achievements_id", "step_achievements", ["id"])
    op.create_index("ix_step_achievements_user_id", "step_achievements", ["user_id"])
    op.create_index(
        "uq_step_achievements_user_key",
        "step_achievements",
        ["user_id", "achievement_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("step_achievements")
