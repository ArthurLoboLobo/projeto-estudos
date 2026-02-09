import json
import logging
from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.document import Document, ProcessingStatus
from app.models.session import SessionStatus, StudySession
from app.prompts import (
    PLAN_REVISION_SYSTEM_PROMPT,
    PLAN_REVISION_USER_PROMPT_TEMPLATE,
    PLAN_SYSTEM_PROMPT,
    PLAN_USER_PROMPT_TEMPLATE,
    language_name,
)
from app.services.ai_client import generate_text

logger = logging.getLogger(__name__)


def _parse_plan_json(response: str) -> list[dict]:
    """Parse AI response into plan JSON, handling markdown code blocks."""
    text = response.strip()

    # Strip markdown code blocks if present
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json or ```)
        lines = lines[1:]
        # Remove last ``` line
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    plan = json.loads(text)

    if not isinstance(plan, list):
        raise ValueError(f"Expected a JSON array, got {type(plan).__name__}")

    # Validate each topic has the required fields
    for item in plan:
        if not isinstance(item, dict):
            raise ValueError(f"Expected topic objects, got {type(item).__name__}")
        if "order_index" not in item or "title" not in item or "subtopics" not in item:
            raise ValueError(
                f"Topic missing required fields (order_index, title, subtopics): {item}"
            )

    return plan


async def generate_plan_stream(
    session_id: UUID,
    db: AsyncSession,
    language: str,
) -> AsyncIterator[dict]:
    """Incrementally build a study plan, yielding SSE events after each document.

    For each completed document in the session, the AI receives the current plan
    plus the document text, and returns an updated plan. Progress events are
    yielded after each document is processed.

    On successful completion, saves the final plan to session.draft_plan and
    updates session status to EDITING_PLAN.
    """
    # Fetch completed documents ordered by upload time
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
        raise ValueError("No completed documents found")

    current_plan: list[dict] = []
    lang = language_name(language)

    for i, doc in enumerate(documents):
        prompt = PLAN_USER_PROMPT_TEMPLATE.format(
            language=lang,
            current_plan=(
                json.dumps(current_plan, ensure_ascii=False, indent=2)
                if current_plan
                else "[]"
            ),
            document_text=doc.content_text or "",
        )

        response = await generate_text(
            system_prompt=PLAN_SYSTEM_PROMPT,
            user_prompt=prompt,
            model=settings.MODEL_PLAN,
        )

        current_plan = _parse_plan_json(response)

        logger.info(
            "Session %s: processed document %d/%d (%d topics)",
            session_id,
            i + 1,
            len(documents),
            len(current_plan),
        )

        yield {
            "event": "document_processed",
            "data": {
                "doc": i + 1,
                "total": len(documents),
                "plan": current_plan,
            },
        }

    # Save final plan to session and transition status
    session = await db.get(StudySession, session_id)
    session.draft_plan = current_plan
    session.status = SessionStatus.EDITING_PLAN
    await db.commit()

    yield {
        "event": "completed",
        "data": {"plan": current_plan},
    }


async def revise_plan(
    current_plan: list[dict],
    instruction: str,
    language: str,
) -> list[dict]:
    """Ask AI to modify the study plan based on user instruction.

    Args:
        current_plan: The current draft plan as a list of topic dicts
        instruction: User's natural language instruction (e.g., "merge topics 3 and 4")
        language: Language code (e.g., 'pt', 'en')

    Returns:
        The modified plan as a list of topic dicts

    Raises:
        ValueError: If AI returns invalid JSON or plan structure
    """
    lang = language_name(language)

    prompt = PLAN_REVISION_USER_PROMPT_TEMPLATE.format(
        language=lang,
        current_plan=json.dumps(current_plan, ensure_ascii=False, indent=2),
        instruction=instruction,
    )

    response = await generate_text(
        system_prompt=PLAN_REVISION_SYSTEM_PROMPT,
        user_prompt=prompt,
        model=settings.MODEL_PLAN,
    )

    revised_plan = _parse_plan_json(response)

    logger.info("Plan revised via AI: %d topics", len(revised_plan))

    return revised_plan
