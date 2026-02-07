import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ChatType(str, enum.Enum):
    TOPIC_SPECIFIC = "TOPIC_SPECIFIC"
    GENERAL_REVIEW = "GENERAL_REVIEW"


class Chat(Base):
    __tablename__ = "chats"
    __table_args__ = (
        UniqueConstraint("topic_id", name="unique_topic_chat"),
        Index("idx_chats_session", "session_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("study_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[ChatType] = mapped_column(
        Enum(
            ChatType,
            name="chat_type",
            create_constraint=False,
            native_enum=True,
        ),
        nullable=False,
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("topics.id", ondelete="CASCADE"),
        nullable=True,
    )
    is_started: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
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

    session: Mapped["StudySession"] = relationship(  # noqa: F821
        back_populates="chats"
    )
    topic: Mapped["Topic | None"] = relationship(back_populates="chat")  # noqa: F821
    messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        back_populates="chat", cascade="all, delete-orphan"
    )
