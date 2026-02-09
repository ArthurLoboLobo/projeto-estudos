import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_language
from app.models.chat import Chat, ChatType
from app.models.document import Document, ProcessingStatus
from app.models.profile import Profile
from app.models.session import SessionStatus, StudySession
from app.models.topic import Topic
from app.schemas.plan import DraftPlan, RevisePlanRequest, SavePlanRequest
from app.schemas.session import CreateSessionRequest, SessionResponse
from app.services.authorization import get_authorized_session
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


@router.get("/{session_id}/plan", response_model=DraftPlan)
async def get_plan(
    session_id: UUID,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current draft study plan.

    Returns the draft_plan JSONB field from the session.
    """
    session = await get_authorized_session(session_id, user.id, db)

    if not session.draft_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No draft plan found. Generate a plan first.",
        )

    return session.draft_plan


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

    # Call AI to revise the plan
    revised_plan = await revise_plan(session.draft_plan, body.instruction, language)

    # Update session with revised plan
    session.draft_plan = revised_plan
    await db.commit()

    logger.info("Plan revised for session %s: %d topics", session_id, len(revised_plan))

    return revised_plan


@router.put("/{session_id}/plan", status_code=status.HTTP_200_OK)
async def save_plan(
    session_id: UUID,
    body: SavePlanRequest,
    user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save the final edited plan and start studying.

    Creates Topic rows and Chat rows in the database:
    - One Topic + Chat (TOPIC_SPECIFIC) for each non-completed topic
    - One Chat (GENERAL_REVIEW) for the session
    - Updates session status to CHUNKING

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

    # Create Topic + Chat rows only for non-completed topics
    created_topics: list[Topic] = []

    for topic_data in body.topics:
        if not topic_data.is_completed:
            # Create Topic
            topic = Topic(
                session_id=session_id,
                title=topic_data.title,
                subtopics=topic_data.subtopics,
                order_index=topic_data.order_index,
                is_completed=False,
            )
            db.add(topic)
            await db.flush()  # Get topic.id

            # Create topic-specific Chat
            topic_chat = Chat(
                session_id=session_id,
                type=ChatType.TOPIC_SPECIFIC,
                topic_id=topic.id,
            )
            db.add(topic_chat)

            created_topics.append(topic)

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
        "Plan saved for session %s: %d topics created (%d total in plan)",
        session_id,
        len(created_topics),
        len(body.topics),
    )

    return {
        "message": "Plan saved successfully",
        "topics_created": len(created_topics),
        "total_topics": len(body.topics),
    }
