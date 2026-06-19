"""add progress photos

Revision ID: 0004
Revises: 0003
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "progress_photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("image_path", sa.String(length=255), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("body_fat_pct", sa.Float(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_progress_photos_id", "progress_photos", ["id"])
    op.create_index("ix_progress_photos_user_id", "progress_photos", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_progress_photos_user_id", table_name="progress_photos")
    op.drop_index("ix_progress_photos_id", table_name="progress_photos")
    op.drop_table("progress_photos")
