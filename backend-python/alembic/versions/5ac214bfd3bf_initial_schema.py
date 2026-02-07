"""initial schema

Revision ID: 5ac214bfd3bf
Revises:
Create Date: 2026-02-07 16:28:27.707822

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = "5ac214bfd3bf"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Enums
    session_status = sa.Enum(
        "UPLOADING",
        "GENERATING_PLAN",
        "EDITING_PLAN",
        "CHUNKING",
        "ACTIVE",
        "COMPLETED",
        name="session_status",
    )
    session_status.create(op.get_bind(), checkfirst=True)

    processing_status = sa.Enum(
        "PENDING", "PROCESSING", "COMPLETED", "FAILED", name="processing_status"
    )
    processing_status.create(op.get_bind(), checkfirst=True)

    chat_type = sa.Enum("TOPIC_SPECIFIC", "GENERAL_REVIEW", name="chat_type")
    chat_type.create(op.get_bind(), checkfirst=True)

    chunk_type = sa.Enum("problem", "theory", name="chunk_type")
    chunk_type.create(op.get_bind(), checkfirst=True)

    # profiles
    op.create_table(
        "profiles",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )

    # study_sessions
    op.create_table(
        "study_sessions",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "profile_id",
            sa.UUID(),
            sa.ForeignKey("profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            session_status,
            nullable=False,
            server_default="UPLOADING",
        ),
        sa.Column("draft_plan", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index("idx_sessions_profile", "study_sessions", ["profile_id"])

    # documents
    op.create_table(
        "documents",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "session_id",
            sa.UUID(),
            sa.ForeignKey("study_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(255), nullable=False),
        sa.Column("file_description", sa.Text(), nullable=True),
        sa.Column("content_text", sa.Text(), nullable=True),
        sa.Column("content_length", sa.Integer(), nullable=True),
        sa.Column(
            "processing_status",
            processing_status,
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index("idx_documents_session", "documents", ["session_id"])

    # topics
    op.create_table(
        "topics",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "session_id",
            sa.UUID(),
            sa.ForeignKey("study_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column(
            "subtopics",
            sa.ARRAY(sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column(
            "is_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index("idx_topics_session", "topics", ["session_id"])

    # chats
    op.create_table(
        "chats",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "session_id",
            sa.UUID(),
            sa.ForeignKey("study_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", chat_type, nullable=False),
        sa.Column(
            "topic_id",
            sa.UUID(),
            sa.ForeignKey("topics.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "is_started",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.UniqueConstraint("topic_id", name="unique_topic_chat"),
    )
    op.create_index("idx_chats_session", "chats", ["session_id"])

    # messages
    op.create_table(
        "messages",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "chat_id",
            sa.UUID(),
            sa.ForeignKey("chats.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('user', 'assistant', 'system')", name="messages_role_check"
        ),
    )
    op.create_index("idx_messages_chat", "messages", ["chat_id"])
    op.create_index("idx_messages_created", "messages", ["chat_id", "created_at"])

    # document_chunks
    op.create_table(
        "document_chunks",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            primary_key=True,
        ),
        sa.Column(
            "document_id",
            sa.UUID(),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            sa.UUID(),
            sa.ForeignKey("study_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_chunk_id",
            sa.UUID(),
            sa.ForeignKey("document_chunks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(768), nullable=True),
        sa.Column("type", chunk_type, nullable=False),
        sa.Column(
            "related_topic_ids",
            sa.ARRAY(sa.UUID()),
            server_default="{}",
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index("idx_chunks_document", "document_chunks", ["document_id"])
    op.create_index("idx_chunks_session", "document_chunks", ["session_id"])
    op.create_index("idx_chunks_parent", "document_chunks", ["parent_chunk_id"])
    op.create_index("idx_chunks_type", "document_chunks", ["type"])
    op.execute(
        """
        CREATE INDEX idx_chunks_embedding ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WHERE embedding IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE INDEX idx_chunks_topics ON document_chunks
        USING GIN (related_topic_ids)
        """
    )


def downgrade() -> None:
    op.drop_table("document_chunks")
    op.drop_table("messages")
    op.drop_table("chats")
    op.drop_table("topics")
    op.drop_table("documents")
    op.drop_table("study_sessions")
    op.drop_table("profiles")

    op.execute("DROP TYPE IF EXISTS chunk_type")
    op.execute("DROP TYPE IF EXISTS chat_type")
    op.execute("DROP TYPE IF EXISTS processing_status")
    op.execute("DROP TYPE IF EXISTS session_status")

    op.execute("DROP EXTENSION IF EXISTS vector")
