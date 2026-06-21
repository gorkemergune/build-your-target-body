"""unique constraint on nutrition_logs(user_id, logged_date)

Revision ID: 0020
Revises: 0019
Create Date: 2024-01-01

"""
from typing import Union

from alembic import op

revision: str = "0020"
down_revision: Union[str, None] = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Deduplicate existing rows — keep the one with the most data (highest id wins)
    # by deleting all but the max id per (user_id, logged_date) pair before adding constraint
    op.execute("""
        DELETE FROM nutrition_logs
        WHERE id NOT IN (
            SELECT MAX(id)
            FROM nutrition_logs
            GROUP BY user_id, logged_date
        )
    """)

    op.create_unique_constraint(
        "uq_nutrition_logs_user_date",
        "nutrition_logs",
        ["user_id", "logged_date"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_nutrition_logs_user_date", "nutrition_logs", type_="unique")
