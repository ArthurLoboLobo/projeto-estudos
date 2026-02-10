import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionStatus(str, enum.Enum):
    UPLOADING = "UPLOADING"
    GENERATING_PLAN = "GENERATING_PLAN"
    EDITING_PLAN = "EDITING_PLAN"
    CHUNKING = "CHUNKING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"


class StudySession(Base):
    __tablename__ = "study_sessions"
    __table_args__ = (Index("idx_sessions_profile", "profile_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(
            SessionStatus,
            name="session_status",
            create_constraint=False,
            native_enum=True,
        ),
        nullable=False,
        server_default="UPLOADING",
    )
    draft_plan: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    plan_history: Mapped[list] = mapped_column(
        JSON, nullable=False, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    profile: Mapped["Profile"] = relationship(back_populates="sessions")  # noqa: F821
    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        back_populates="session", cascade="all, delete-orphan"
    )
    topics: Mapped[list["Topic"]] = relationship(  # noqa: F821
        back_populates="session", cascade="all, delete-orphan"
    )
    chats: Mapped[list["Chat"]] = relationship(  # noqa: F821
        back_populates="session", cascade="all, delete-orphan"
    )
    chunks: Mapped[list["DocumentChunk"]] = relationship(  # noqa: F821
        back_populates="session", cascade="all, delete-orphan"
    )
