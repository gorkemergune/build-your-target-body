"""wearable connections and health sync HR columns

Revision ID: 0017
Revises: 0016
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add HR columns to health_sync_logs
    op.add_column("health_sync_logs", sa.Column("resting_heart_rate_bpm", sa.Integer(), nullable=True))
    op.add_column("health_sync_logs", sa.Column("avg_heart_rate_bpm", sa.Integer(), nullable=True))
    op.add_column("health_sync_logs", sa.Column("max_heart_rate_bpm", sa.Integer(), nullable=True))

    # Create wearable_connections table
    op.create_table(
        "wearable_connections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("platform", sa.String(50), nullable=False),
        sa.Column("is_connected", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expiry", sa.DateTime(), nullable=True),
        sa.Column("external_user_id", sa.String(255), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(), nullable=True),
        sa.Column("connected_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_wearable_connections_id", "wearable_connections", ["id"])
    op.create_index("ix_wearable_connections_user_id", "wearable_connections", ["user_id"])


def downgrade() -> None:
    op.drop_table("wearable_connections")
    op.drop_column("health_sync_logs", "max_heart_rate_bpm")
    op.drop_column("health_sync_logs", "avg_heart_rate_bpm")
    op.drop_column("health_sync_logs", "resting_heart_rate_bpm")
