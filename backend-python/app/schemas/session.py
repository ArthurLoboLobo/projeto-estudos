from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.models.session import SessionStatus


class CreateSessionRequest(BaseModel):
    title: str
    description: str | None = None


class SessionResponse(BaseModel):
    id: UUID
    profile_id: UUID
    title: str
    description: str | None
    status: SessionStatus
    draft_plan: Any | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
