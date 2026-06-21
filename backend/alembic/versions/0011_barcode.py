"""add barcode_cache and barcode_scans

Revision ID: 0011
Revises: 0010
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "barcode_cache",
        sa.Column("barcode", sa.String(20), primary_key=True),
        sa.Column("food_name", sa.String(300), nullable=False),
        sa.Column("brand", sa.String(200), nullable=True),
        sa.Column("calories_per_100g", sa.Float, nullable=True),
        sa.Column("protein_g_per_100g", sa.Float, nullable=True),
        sa.Column("carbs_g_per_100g", sa.Float, nullable=True),
        sa.Column("fat_g_per_100g", sa.Float, nullable=True),
        sa.Column("serving_size_g", sa.Float, nullable=True),
        sa.Column("serving_size_desc", sa.String(100), nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="openfoodfacts"),
        sa.Column("fetched_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "barcode_scans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("barcode", sa.String(20), nullable=False),
        sa.Column("success", sa.Boolean, nullable=False),
        sa.Column("scan_source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_barcode_scans_id", "barcode_scans", ["id"])
    op.create_index("ix_barcode_scans_user_id", "barcode_scans", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_barcode_scans_user_id", "barcode_scans")
    op.drop_index("ix_barcode_scans_id", "barcode_scans")
    op.drop_table("barcode_scans")
    op.drop_table("barcode_cache")
