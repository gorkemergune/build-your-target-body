"""add photo_path to nutrition_logs

Revision ID: 0007
Revises: 0006
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "nutrition_logs",
        sa.Column("photo_path", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("nutrition_logs", "photo_path")
