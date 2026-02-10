import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_language
from app.models.chat import Chat, ChatType
from app.models.chunk import DocumentChunk
from app.models.document import Document, ProcessingStatus
from app.models.profile import Profile
from app.models.session import SessionStatus, StudySession
from app.models.topic import Topic
from app.schemas.plan import (
    DraftPlan,
    PlanResponse,
    RevisePlanRequest,
    SavePlanRequest,
    UpdatePlanRequest,
)
from app.schemas.session import CreateSessionRequest, SessionResponse
from app.services.authorization import get_authorized_session
from app.services.chunking import process_document_for_chunks
from app.services.study_plan import generate_plan_stream, revise_plan

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StudySession)
        .where(StudySession.profile_id == user.id)
        .order_by(StudySession.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = StudySession(
        title=body.title,
        description=body.description,
        profile_id=user.id,
        status=SessionStatus.UPLOADING,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_authorized_session(session_id, user.id, db)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await get_authorized_session(session_id, user.id, db)
    await db.delete(session)
    await db.commit()


@router.get("/{session_id}/generate-plan")
async def generate_plan(
    session_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    language: str = Depends(get_language),
):
    """SSE endpoint that incrementally generates a study plan.

    Streams progress events as each document is processed by the AI.
    On completion, saves the draft plan and transitions to EDITING_PLAN.
    On error, reverts status to UPLOADING so the user can retry.
    """
    session = await get_authorized_session(session_id, user.id, db)

    if session.status != SessionStatus.UPLOADING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Session status is '{session.status.value}', "
                f"expected 'UPLOADING'"
            ),
        )

    # Verify at least 1 completed document exists
    result = await db.execute(
        select(func.count(Document.id)).where(
            Document.session_id == session_id,
            Document.processing_status == ProcessingStatus.COMPLETED,
        )
    )
    doc_count = result.scalar()
    if not doc_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No completed documents found. Wait for text extraction to finish.",
        )

    # Transition to GENERATING_PLAN before streaming begins
    session.status = SessionStatus.GENERATING_PLAN
    await db.commit()

    async def event_stream():
        try:
            async for event in generate_plan_stream(session_id, db, language):
                event_type = event["event"]
                event_data = json.dumps(event["data"], ensure_ascii=False)
                yield f"event: {event_type}\ndata: {event_data}\n\n"
        except Exception as exc:
            logger.exception("Plan generation failed for session %s", session_id)
            # Revert status so user can retry
            try:
                await db.rollback()
                reloaded = await db.get(StudySession, session_id)
                if reloaded:
                    reloaded.status = SessionStatus.UPLOADING
                    await db.commit()
            except Exception:
                logger.exception("Failed to revert session status for %s", session_id)
            yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/{session_id}/plan", response_model=PlanResponse)
async def get_plan(
    session_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current draft study plan.

    Returns the draft_plan and whether undo is available.
    """
    session = await get_authorized_session(session_id, user.id, db)

    if not session.draft_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No draft plan found. Generate a plan first.",
        )

    return PlanResponse(
        topics=session.draft_plan,
        can_undo=bool(session.plan_history),
    )


@router.post("/{session_id}/revise-plan", response_model=DraftPlan)
async def revise_study_plan(
    session_id: UUID,
    body: RevisePlanRequest,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    language: str = Depends(get_language),
):
    """Ask AI to modify the draft plan based on user instruction.

    User provides a natural language instruction like "merge topics 3 and 4"
    or "add a topic about limits". AI returns the modified plan.
    """
    session = await get_authorized_session(session_id, user.id, db)

    if session.status != SessionStatus.EDITING_PLAN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Session status is '{session.status.value}', "
                f"expected 'EDITING_PLAN'"
            ),
        )

    if not session.draft_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No draft plan found. Generate a plan first.",
        )

    # Push current plan to history before changing it
    history = list(session.plan_history or [])
    history.append(session.draft_plan)
    session.plan_history = history

    # Call AI to revise the plan
    revised_plan = await revise_plan(session.draft_plan, body.instruction, language)

    # Update session with revised plan
    session.draft_plan = revised_plan
    await db.commit()

    logger.info("Plan revised for session %s: %d topics", session_id, len(revised_plan))

    return revised_plan


@router.post("/{session_id}/update-plan", response_model=DraftPlan)
async def update_plan(
    session_id: UUID,
    body: UpdatePlanRequest,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save manual edits to the draft plan (not the final save).

    Called by the frontend whenever the user makes manual changes (add, delete,
    edit, reorder, toggle completion). Pushes the old plan to history so the
    user can undo.
    """
    session = await get_authorized_session(session_id, user.id, db)

    if session.status != SessionStatus.EDITING_PLAN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Session status is '{session.status.value}', "
                f"expected 'EDITING_PLAN'"
            ),
        )

    if not session.draft_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No draft plan found. Generate a plan first.",
        )

    # Push current plan to history before changing it
    history = list(session.plan_history or [])
    history.append(session.draft_plan)
    session.plan_history = history

    # Update with the new plan from frontend
    session.draft_plan = [topic.model_dump() for topic in body.topics]
    await db.commit()

    return session.draft_plan


@router.post("/{session_id}/undo-plan", response_model=DraftPlan)
async def undo_plan(
    session_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Undo the last plan change.

    Pops the most recent snapshot from plan_history and sets it as the current
    draft_plan. Can be called multiple times to undo several changes.
    """
    session = await get_authorized_session(session_id, user.id, db)

    if session.status != SessionStatus.EDITING_PLAN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Session status is '{session.status.value}', "
                f"expected 'EDITING_PLAN'"
            ),
        )

    history = list(session.plan_history or [])
    if not history:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nothing to undo.",
        )

    # Pop last snapshot and restore it
    previous_plan = history.pop()
    session.draft_plan = previous_plan
    session.plan_history = history
    await db.commit()

    logger.info(
        "Plan undone for session %s: %d remaining in history",
        session_id,
        len(history),
    )

    return previous_plan


@router.put("/{session_id}/plan", status_code=status.HTTP_200_OK)
async def save_plan(
    session_id: UUID,
    body: SavePlanRequest,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save the final edited plan and start studying.

    Creates Topic rows and Chat rows in the database:
    - One Topic + Chat (TOPIC_SPECIFIC) for each topic (completed ones start marked)
    - One Chat (GENERAL_REVIEW) for the session
    - Updates session status to CHUNKING
    - Clears plan_history (no longer needed)

    The full plan (including completed topics) is preserved in session.draft_plan
    for the chunking phase to reference.
    """
    session = await get_authorized_session(session_id, user.id, db)

    if session.status != SessionStatus.EDITING_PLAN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Session status is '{session.status.value}', "
                f"expected 'EDITING_PLAN'"
            ),
        )

    # Update draft_plan with the final edited version from frontend
    session.draft_plan = [topic.model_dump() for topic in body.topics]
    # Clear history — no longer needed after finalizing
    session.plan_history = []

    # Create Topic + Chat rows for ALL topics.
    # Completed topics start with is_completed=True; the student can still
    # open the chat and unmark them later.
    for topic_data in body.topics:
        topic = Topic(
            session_id=session_id,
            title=topic_data.title,
            subtopics=topic_data.subtopics,
            order_index=topic_data.order_index,
            is_completed=topic_data.is_completed,
        )
        db.add(topic)
        await db.flush()  # Get topic.id

        topic_chat = Chat(
            session_id=session_id,
            type=ChatType.TOPIC_SPECIFIC,
            topic_id=topic.id,
        )
        db.add(topic_chat)

    # Create general review Chat
    general_chat = Chat(
        session_id=session_id,
        type=ChatType.GENERAL_REVIEW,
        topic_id=None,
    )
    db.add(general_chat)

    # Update session status to CHUNKING
    session.status = SessionStatus.CHUNKING
    await db.commit()

    logger.info(
        "Plan saved for session %s: %d topics created",
        session_id,
        len(body.topics),
    )

    return {
        "message": "Plan saved successfully",
        "topics_created": len(body.topics),
    }


@router.get("/{session_id}/create-chunks")
async def create_chunks(
    session_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    language: str = Depends(get_language),
):
    """SSE endpoint that processes all documents for chunking.

    For each document, the AI analyzes its content and creates structured
    chunks (theory + problems) with embeddings. Progress events are streamed
    as each document completes.

    On success: session status → ACTIVE.
    On error: session status → EDITING_PLAN (so user can retry).
    """
    session = await get_authorized_session(session_id, user.id, db)

    if session.status != SessionStatus.CHUNKING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Session status is '{session.status.value}', "
                f"expected 'CHUNKING'"
            ),
        )

    # Fetch all completed documents
    result = await db.execute(
        select(Document)
        .where(
            Document.session_id == session_id,
            Document.processing_status == ProcessingStatus.COMPLETED,
        )
        .order_by(Document.created_at)
    )
    documents = result.scalars().all()

    if not documents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No completed documents found.",
        )

    # Fetch all topics for this session (for order_index → UUID mapping)
    topic_result = await db.execute(
        select(Topic)
        .where(Topic.session_id == session_id)
        .order_by(Topic.order_index)
    )
    topics = topic_result.scalars().all()

    # Get the draft plan
    plan = session.draft_plan or []

    async def event_stream():
        try:
            # Delete any existing chunks for idempotent restart
            await db.execute(
                delete(DocumentChunk).where(
                    DocumentChunk.session_id == session_id
                )
            )
            await db.flush()

            total = len(documents)

            # Process documents sequentially — each document does AI calls +
            # DB writes on the same session, so concurrent access would be
            # unsafe. AI calls are the bottleneck anyway.
            for i, doc in enumerate(documents):
                try:
                    await process_document_for_chunks(
                        doc, topics, plan, language, db
                    )
                except Exception as exc:
                    logger.exception(
                        "Failed to chunk document %s", doc.id
                    )
                    # Continue with remaining documents rather than aborting

                yield (
                    f"event: document_chunked\n"
                    f"data: {json.dumps({'doc': i + 1, 'total': total}, ensure_ascii=False)}\n\n"
                )

            # Transition to ACTIVE
            session_obj = await db.get(StudySession, session_id)
            if session_obj:
                session_obj.status = SessionStatus.ACTIVE
            await db.commit()

            yield f"event: completed\ndata: {json.dumps({'message': 'Chunking complete'})}\n\n"

        except Exception as exc:
            logger.exception("Chunking failed for session %s", session_id)
            # Revert status so user can retry
            try:
                await db.rollback()
                reloaded = await db.get(StudySession, session_id)
                if reloaded:
                    reloaded.status = SessionStatus.EDITING_PLAN
                    await db.commit()
            except Exception:
                logger.exception(
                    "Failed to revert session status for %s", session_id
                )
            yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )
