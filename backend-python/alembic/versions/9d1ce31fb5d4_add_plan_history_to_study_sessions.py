"""add plan_history to study_sessions

Revision ID: 9d1ce31fb5d4
Revises: 5ac214bfd3bf
Create Date: 2026-02-10 12:13:47.866764

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision: str = '9d1ce31fb5d4'
down_revision: Union[str, Sequence[str], None] = '5ac214bfd3bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "study_sessions",
        sa.Column("plan_history", JSON, nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("study_sessions", "plan_history")
