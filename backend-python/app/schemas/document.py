from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.document import ProcessingStatus


class DocumentResponse(BaseModel):
    id: UUID
    session_id: UUID
    file_name: str
    file_path: str
    file_description: str | None
    content_text: str | None
    content_length: int | None
    processing_status: ProcessingStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentUrlResponse(BaseModel):
    url: str
