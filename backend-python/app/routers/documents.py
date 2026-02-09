import uuid as _uuid
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func as sqlfunc

from app.database import get_db
from app.dependencies import get_current_user
from app.models.document import Document
from app.models.profile import Profile
from app.models.session import SessionStatus
from app.schemas.document import DocumentResponse, DocumentUrlResponse
from app.services.authorization import get_authorized_session
from app.services.documents import process_document_background
from app.services.storage import delete_file as storage_delete_file
from app.services.storage import upload_file as storage_upload_file

router = APIRouter(tags=["documents"])

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
MAX_SESSION_SIZE = 150 * 1024 * 1024  # 150 MB


@router.post(
    "/sessions/{session_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    session_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await get_authorized_session(session_id, user.id, db)

    if session.status != SessionStatus.UPLOADING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not in UPLOADING status",
        )

    # Validate content type
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    # Read file and validate size
    file_bytes = await file.read()
    file_size = len(file_bytes)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum size of {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    # Session total size check: the Document model has no file_size column,
    # so we approximate by counting existing docs × MAX_FILE_SIZE as upper bound.
    # Per-file limit (25MB) is the primary guard; session limit (150MB) is best-effort.
    existing_count_result = await db.execute(
        select(sqlfunc.count()).select_from(Document).where(Document.session_id == session_id)
    )
    existing_count = existing_count_result.scalar() or 0
    # With 25MB per file, 150MB session budget allows at most 6 files.
    # A more precise check would require a file_size column on Document.
    if (existing_count + 1) * MAX_FILE_SIZE > MAX_SESSION_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session exceeds maximum total size of {MAX_SESSION_SIZE // (1024 * 1024)}MB",
        )

    # Upload to Supabase Storage
    storage_path = f"{user.id}/{session_id}/{_uuid.uuid4()}.pdf"
    await storage_upload_file(storage_path, file_bytes, "application/pdf")

    # Create document row
    document = Document(
        session_id=session_id,
        file_name=file.filename or "document.pdf",
        file_path=storage_path,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Start text extraction in background
    background_tasks.add_task(process_document_background, document.id, storage_path)

    return document


@router.get("/sessions/{session_id}/documents", response_model=list[DocumentResponse])
async def list_documents(
    session_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_authorized_session(session_id, user.id, db)
    result = await db.execute(
        select(Document)
        .where(Document.session_id == session_id)
        .order_by(Document.created_at)
    )
    return result.scalars().all()


@router.delete(
    "/sessions/{session_id}/documents/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_document(
    session_id: UUID,
    doc_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_authorized_session(session_id, user.id, db)

    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.session_id == session_id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    # Delete from storage (best-effort — don't fail the request if storage delete fails)
    try:
        await storage_delete_file(document.file_path)
    except Exception:
        pass  # Storage file may already be gone

    await db.delete(document)
    await db.commit()


@router.get("/documents/{doc_id}/url", response_model=DocumentUrlResponse)
async def get_document_url(
    doc_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Document).where(Document.id == doc_id))
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
        )

    # Verify the document's session is owned by this user
    await get_authorized_session(document.session_id, user.id, db)

    from app.services.storage import get_signed_url

    url = await get_signed_url(document.file_path)
    return DocumentUrlResponse(url=url)
