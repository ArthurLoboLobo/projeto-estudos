from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.profile import Profile
from app.models.session import SessionStatus, StudySession
from app.schemas.session import CreateSessionRequest, SessionResponse
from app.services.authorization import get_authorized_session

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
