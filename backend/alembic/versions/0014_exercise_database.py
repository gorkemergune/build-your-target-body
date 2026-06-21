"""add exercise database

Revision ID: 0014
Revises: 0013
Create Date: 2024-01-01

"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exercise_categories",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("name_tr", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
    )
    op.create_index("ix_exercise_categories_id", "exercise_categories", ["id"])
    op.create_index("ix_exercise_categories_slug", "exercise_categories", ["slug"])

    op.create_table(
        "muscle_groups",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("name_tr", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
    )
    op.create_index("ix_muscle_groups_id", "muscle_groups", ["id"])

    op.create_table(
        "exercises",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("name_tr", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category_id", sa.Integer, sa.ForeignKey("exercise_categories.id"), nullable=False),
        sa.Column("primary_muscle_id", sa.Integer, sa.ForeignKey("muscle_groups.id"), nullable=False),
        sa.Column("secondary_muscles", sa.Text, nullable=True),
        sa.Column("equipment", sa.String(100), nullable=False, server_default="bodyweight"),
        sa.Column("difficulty", sa.String(50), nullable=False, server_default="beginner"),
        sa.Column("image_url", sa.String(500), nullable=True),
    )
    op.create_index("ix_exercises_id", "exercises", ["id"])
    op.create_index("ix_exercises_name", "exercises", ["name"])
    op.create_index("ix_exercises_category_id", "exercises", ["category_id"])
    op.create_index("ix_exercises_primary_muscle_id", "exercises", ["primary_muscle_id"])

    op.add_column(
        "workout_exercises",
        sa.Column("exercise_id", sa.Integer, sa.ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("workout_exercises", "exercise_id")
    op.drop_index("ix_exercises_primary_muscle_id", "exercises")
    op.drop_index("ix_exercises_category_id", "exercises")
    op.drop_index("ix_exercises_name", "exercises")
    op.drop_index("ix_exercises_id", "exercises")
    op.drop_table("exercises")
    op.drop_index("ix_muscle_groups_id", "muscle_groups")
    op.drop_table("muscle_groups")
    op.drop_index("ix_exercise_categories_slug", "exercise_categories")
    op.drop_index("ix_exercise_categories_id", "exercise_categories")
    op.drop_table("exercise_categories")
