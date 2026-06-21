"""compound indexes for date-filtered queries

Revision ID: 0019
Revises: 0018
Create Date: 2024-01-01

"""
from typing import Union

from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # weight_logs: every analytics query filters by user_id + logged_at range
    op.create_index("ix_weight_logs_user_logged", "weight_logs", ["user_id", "logged_at"])

    # nutrition_logs: filtered by user_id + logged_date in today-summary, consistency, trends
    op.create_index("ix_nutrition_logs_user_date", "nutrition_logs", ["user_id", "logged_date"])

    # body_fat_logs: filtered by user_id + logged_at in fat-trend
    op.create_index("ix_body_fat_logs_user_logged", "body_fat_logs", ["user_id", "logged_at"])

    # measurement_logs: filtered by user_id + logged_at in measurement-trend
    op.create_index("ix_measurement_logs_user_logged", "measurement_logs", ["user_id", "logged_at"])

    # workouts: filtered by user_id + logged_at in workout analytics, intelligence, consistency
    op.create_index("ix_workouts_user_logged", "workouts", ["user_id", "logged_at"])

    # ai_conversations: ordered by created_at per user for conversation list
    op.create_index("ix_ai_conversations_user_created", "ai_conversations", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_ai_conversations_user_created", "ai_conversations")
    op.drop_index("ix_workouts_user_logged", "workouts")
    op.drop_index("ix_measurement_logs_user_logged", "measurement_logs")
    op.drop_index("ix_body_fat_logs_user_logged", "body_fat_logs")
    op.drop_index("ix_nutrition_logs_user_date", "nutrition_logs")
    op.drop_index("ix_weight_logs_user_logged", "weight_logs")
