import enum
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ChunkType(str, enum.Enum):
    problem = "problem"
    theory = "theory"


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        Index("idx_chunks_document", "document_id"),
        Index("idx_chunks_session", "session_id"),
        Index("idx_chunks_parent", "parent_chunk_id"),
        Index("idx_chunks_type", "type"),
        Index(
            "idx_chunks_topics",
            "related_topic_ids",
            postgresql_using="gin",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("study_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    parent_chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_chunks.id", ondelete="CASCADE"),
        nullable=True,
    )
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(768), nullable=True)
    type: Mapped[ChunkType] = mapped_column(
        Enum(
            ChunkType,
            name="chunk_type",
            create_constraint=False,
            native_enum=True,
        ),
        nullable=False,
    )
    related_topic_ids: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(UUID(as_uuid=True)), server_default="{}", nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    document: Mapped["Document"] = relationship(  # noqa: F821
        back_populates="chunks"
    )
    session: Mapped["StudySession"] = relationship(  # noqa: F821
        back_populates="chunks"
    )
    parent: Mapped["DocumentChunk | None"] = relationship(
        remote_side="DocumentChunk.id", backref="children"
    )
