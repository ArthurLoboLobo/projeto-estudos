import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.chunk import ChunkType, DocumentChunk
from app.models.document import Document
from app.models.topic import Topic
from app.prompts import (
    CHUNKING_RETRY_PROMPT_TEMPLATE,
    CHUNKING_SYSTEM_PROMPT,
    CHUNKING_USER_PROMPT_TEMPLATE,
    language_name,
)
from app.services.ai_client import generate_text
from app.services.embeddings import embed_texts
from app.utils.tokens import estimate_tokens

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data classes for parsed XML response
# ---------------------------------------------------------------------------


@dataclass
class TheoreticalContent:
    related_topic_indices: list[int]
    content: str


@dataclass
class Problem:
    description: str
    related_topic_indices: list[int]
    statement: str
    solution: Optional[str] = None


@dataclass
class DocumentAnalysis:
    file_description: str
    theoretical_content: Optional[TheoreticalContent] = None
    problems: list[Problem] = field(default_factory=list)


# ---------------------------------------------------------------------------
# XML parser (regex-based, resilient to LLM quirks)
# ---------------------------------------------------------------------------


def _extract_tag(text: str, tag: str) -> Optional[str]:
    """Extract content between <TAG>...</TAG>, or None if not found."""
    pattern = rf"<{tag}>(.*?)</{tag}>"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return None


def _extract_all_blocks(text: str, tag: str) -> list[str]:
    """Extract all occurrences of <TAG>...</TAG>."""
    pattern = rf"<{tag}>(.*?)</{tag}>"
    return [m.group(1).strip() for m in re.finditer(pattern, text, re.DOTALL)]


def _parse_topic_indices(text: Optional[str]) -> list[int]:
    """Parse comma-separated integers from a RELATED_TOPICS string."""
    if not text:
        return []
    indices = []
    for part in text.split(","):
        part = part.strip()
        if part.isdigit():
            indices.append(int(part))
    return indices


def parse_document_analysis(response: str) -> DocumentAnalysis:
    """Parse the AI's XML-like response into a DocumentAnalysis object.

    Raises ValueError if FILE_DESCRIPTION is missing (the only required tag).
    """
    file_description = _extract_tag(response, "FILE_DESCRIPTION")
    if not file_description:
        raise ValueError("Missing required <FILE_DESCRIPTION> tag in AI response")

    # Parse theoretical content (optional)
    theoretical_content = None
    theory_block = _extract_tag(response, "THEORETICAL_CONTENT")
    if theory_block:
        related_str = _extract_tag(theory_block, "RELATED_TOPICS")
        content = _extract_tag(theory_block, "CONTENT")
        if content:
            theoretical_content = TheoreticalContent(
                related_topic_indices=_parse_topic_indices(related_str),
                content=content,
            )

    # Parse problems (optional, multiple)
    problems = []
    problem_blocks = _extract_all_blocks(response, "PROBLEM")
    for block in problem_blocks:
        description = _extract_tag(block, "DESCRIPTION")
        if not description:
            continue  # Skip malformed problem blocks
        related_str = _extract_tag(block, "RELATED_TOPICS")
        statement = _extract_tag(block, "STATEMENT")
        if not statement:
            continue
        solution = _extract_tag(block, "SOLUTION")
        problems.append(
            Problem(
                description=description,
                related_topic_indices=_parse_topic_indices(related_str),
                statement=statement,
                solution=solution,
            )
        )

    return DocumentAnalysis(
        file_description=file_description,
        theoretical_content=theoretical_content,
        problems=problems,
    )


# ---------------------------------------------------------------------------
# Chunking logic
# ---------------------------------------------------------------------------

THEORY_CHUNK_SIZE = 400  # target tokens
THEORY_OVERLAP = 80  # ~20% overlap in tokens
PROBLEM_CHUNK_SIZE = 400  # target tokens for child chunks


def _split_text_into_chunks(
    text: str, chunk_size: int, overlap: int
) -> list[str]:
    """Split text into overlapping chunks based on estimated token counts.

    Tries to break at paragraph/sentence boundaries when possible.
    """
    if estimate_tokens(text) <= chunk_size:
        return [text]

    # Split into paragraphs first
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_tokens = 0

    for para in paragraphs:
        para_tokens = estimate_tokens(para)

        # If a single paragraph exceeds chunk size, split by sentences
        if para_tokens > chunk_size and not current_chunk:
            sentences = re.split(r"(?<=[.!?])\s+", para)
            for sentence in sentences:
                sent_tokens = estimate_tokens(sentence)
                if current_tokens + sent_tokens > chunk_size and current_chunk:
                    chunks.append("\n\n".join(current_chunk))
                    # Overlap: keep some trailing content
                    overlap_text = _get_overlap_text(current_chunk, overlap)
                    current_chunk = [overlap_text] if overlap_text else []
                    current_tokens = estimate_tokens(overlap_text) if overlap_text else 0
                current_chunk.append(sentence)
                current_tokens += sent_tokens
            continue

        if current_tokens + para_tokens > chunk_size and current_chunk:
            chunks.append("\n\n".join(current_chunk))
            # Overlap: keep some trailing content
            overlap_text = _get_overlap_text(current_chunk, overlap)
            current_chunk = [overlap_text] if overlap_text else []
            current_tokens = estimate_tokens(overlap_text) if overlap_text else 0

        current_chunk.append(para)
        current_tokens += para_tokens

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks


def _get_overlap_text(paragraphs: list[str], target_tokens: int) -> str:
    """Get text from the end of paragraphs that fits within target_tokens."""
    result: list[str] = []
    total = 0
    for para in reversed(paragraphs):
        para_tokens = estimate_tokens(para)
        if total + para_tokens > target_tokens:
            break
        result.insert(0, para)
        total += para_tokens
    return "\n\n".join(result)


def _build_order_index_to_uuid(
    topics: list[Topic], plan: list[dict]
) -> dict[int, uuid.UUID]:
    """Build a mapping from order_index → Topic UUID.

    Uses the topics from the DB (which have UUIDs) and matches them
    by order_index from the draft plan.
    """
    topic_by_order: dict[int, uuid.UUID] = {}
    for topic in topics:
        topic_by_order[topic.order_index] = topic.id
    return topic_by_order


def _resolve_topic_ids(
    indices: list[int], index_to_uuid: dict[int, uuid.UUID]
) -> list[uuid.UUID]:
    """Map order_index values to topic UUIDs, silently dropping invalid ones."""
    result = []
    for idx in indices:
        if idx in index_to_uuid:
            result.append(index_to_uuid[idx])
    return result


def create_theory_chunks(
    analysis: DocumentAnalysis,
    doc: Document,
    session_id: uuid.UUID,
    index_to_uuid: dict[int, uuid.UUID],
) -> list[DocumentChunk]:
    """Create overlapping theory chunks from theoretical content."""
    if not analysis.theoretical_content:
        return []

    tc = analysis.theoretical_content
    topic_ids = _resolve_topic_ids(tc.related_topic_indices, index_to_uuid)
    text_chunks = _split_text_into_chunks(tc.content, THEORY_CHUNK_SIZE, THEORY_OVERLAP)

    chunks = []
    for text in text_chunks:
        chunk = DocumentChunk(
            document_id=doc.id,
            session_id=session_id,
            parent_chunk_id=None,
            chunk_text=text,
            embedding=None,  # computed later in batch
            type=ChunkType.theory,
            related_topic_ids=topic_ids,
        )
        chunks.append(chunk)

    return chunks


def create_problem_chunks(
    analysis: DocumentAnalysis,
    doc: Document,
    session_id: uuid.UUID,
    index_to_uuid: dict[int, uuid.UUID],
) -> list[tuple[DocumentChunk, list[DocumentChunk]]]:
    """Create hierarchical problem chunks (parent + children).

    Returns a list of (parent_chunk, [child_chunks]) tuples.
    Parent chunks are NOT embedded; only children are.
    """
    if not analysis.problems:
        return []

    results = []

    for problem in analysis.problems:
        topic_ids = _resolve_topic_ids(problem.related_topic_indices, index_to_uuid)

        # Build parent chunk text with headers
        parent_text_parts = [
            f"[File: {analysis.file_description}]",
            "",
            f"[Problem: {problem.description}]",
            "",
            "[Statement]",
            problem.statement,
        ]
        if problem.solution:
            parent_text_parts.extend(["", "[Solution]", problem.solution])

        parent_text = "\n".join(parent_text_parts)

        parent = DocumentChunk(
            document_id=doc.id,
            session_id=session_id,
            parent_chunk_id=None,
            chunk_text=parent_text,
            embedding=None,  # Parent is NOT embedded
            type=ChunkType.problem,
            related_topic_ids=topic_ids,
        )

        # Split parent text into child chunks
        child_texts = _split_text_into_chunks(parent_text, PROBLEM_CHUNK_SIZE, 0)

        children = []
        for text in child_texts:
            child = DocumentChunk(
                document_id=doc.id,
                session_id=session_id,
                parent_chunk_id=None,  # Set after parent is flushed
                chunk_text=text,
                embedding=None,  # computed later in batch
                type=ChunkType.problem,
                related_topic_ids=topic_ids,
            )
            children.append(child)

        results.append((parent, children))

    return results


def create_fallback_chunks(
    doc: Document,
    session_id: uuid.UUID,
) -> list[DocumentChunk]:
    """Create simple overlapping chunks when XML parsing fails entirely.

    No topic linking, no problem/theory distinction — just raw text chunks.
    """
    text = doc.content_text or ""
    if not text.strip():
        return []

    text_chunks = _split_text_into_chunks(text, THEORY_CHUNK_SIZE, THEORY_OVERLAP)

    chunks = []
    for chunk_text in text_chunks:
        chunk = DocumentChunk(
            document_id=doc.id,
            session_id=session_id,
            parent_chunk_id=None,
            chunk_text=chunk_text,
            embedding=None,
            type=ChunkType.theory,
            related_topic_ids=[],
        )
        chunks.append(chunk)

    return chunks


# ---------------------------------------------------------------------------
# Pipeline orchestration
# ---------------------------------------------------------------------------


def _format_plan_for_prompt(plan: list[dict]) -> str:
    """Format the study plan for the chunking prompt."""
    lines = []
    for topic in plan:
        idx = topic.get("order_index", "?")
        title = topic.get("title", "Untitled")
        subtopics = topic.get("subtopics", [])
        lines.append(f"{idx}. {title}")
        for st in subtopics:
            lines.append(f"   - {st}")
    return "\n".join(lines)


async def process_document_for_chunks(
    doc: Document,
    topics: list[Topic],
    plan: list[dict],
    language: str,
    db: AsyncSession,
) -> None:
    """Full chunking pipeline for a single document.

    1. Call AI to analyze document → XML response
    2. Parse XML (with retry on failure, max 3 attempts)
    3. If all parsing fails → fallback to simple chunks
    4. Create theory chunks (overlapping)
    5. Create problem chunks (hierarchical: parent + children)
    6. Compute embeddings for all embeddable chunks
    7. Save all chunks to database
    8. Save file_description to document
    """
    lang = language_name(language)
    plan_text = _format_plan_for_prompt(plan)
    document_text = doc.content_text or ""

    if not document_text.strip():
        logger.warning("Document %s has no content text, skipping", doc.id)
        return

    index_to_uuid = _build_order_index_to_uuid(topics, plan)

    # Step 1-2: Call AI and parse XML with retry
    analysis = await _analyze_document_with_retry(
        document_text, plan_text, lang, max_attempts=3
    )

    all_chunks: list[DocumentChunk] = []
    parent_count = 0

    if analysis is None:
        # Step 3: Fallback — all parsing attempts failed
        logger.warning(
            "All parsing attempts failed for document %s, using fallback chunks",
            doc.id,
        )
        all_chunks = create_fallback_chunks(doc, doc.session_id)
    else:
        # Save file_description
        doc.file_description = analysis.file_description

        # Step 4: Theory chunks
        theory_chunks = create_theory_chunks(analysis, doc, doc.session_id, index_to_uuid)
        all_chunks.extend(theory_chunks)

        # Step 5: Problem chunks (hierarchical)
        problem_groups = create_problem_chunks(
            analysis, doc, doc.session_id, index_to_uuid
        )
        for parent, children in problem_groups:
            db.add(parent)
            await db.flush()  # Get parent.id
            parent_count += 1
            for child in children:
                child.parent_chunk_id = parent.id
            all_chunks.extend(children)
            # Parent is already in session, no need to add to all_chunks for embedding

    # Step 6: Compute embeddings for embeddable chunks
    embeddable_chunks = [c for c in all_chunks if c.chunk_text.strip()]
    if embeddable_chunks:
        texts = [c.chunk_text for c in embeddable_chunks]
        try:
            embeddings = await embed_texts(texts)
            for chunk, embedding in zip(embeddable_chunks, embeddings):
                chunk.embedding = embedding
        except Exception:
            logger.exception(
                "Failed to compute embeddings for document %s, saving chunks without embeddings",
                doc.id,
            )

    # Step 7: Save chunks
    for chunk in all_chunks:
        db.add(chunk)

    await db.flush()

    logger.info(
        "Document %s: %d parent chunks + %d child/theory chunks (%d embedded)",
        doc.id,
        parent_count,
        len(all_chunks),
        len(embeddable_chunks),
    )


async def _analyze_document_with_retry(
    document_text: str,
    plan_text: str,
    language: str,
    max_attempts: int = 3,
) -> Optional[DocumentAnalysis]:
    """Call AI to analyze document and parse XML, retrying on parse failures.

    Returns DocumentAnalysis on success, None if all attempts fail.
    """
    last_error = ""

    for attempt in range(max_attempts):
        try:
            if attempt == 0:
                prompt = CHUNKING_USER_PROMPT_TEMPLATE.format(
                    language=language,
                    study_plan=plan_text,
                    document_text=document_text,
                )
            else:
                prompt = CHUNKING_RETRY_PROMPT_TEMPLATE.format(
                    error=last_error,
                    document_text=document_text,
                    study_plan=plan_text,
                )

            response = await generate_text(
                system_prompt=CHUNKING_SYSTEM_PROMPT,
                user_prompt=prompt,
                model=settings.MODEL_CHUNKING,
            )

            analysis = parse_document_analysis(response)
            return analysis

        except ValueError as e:
            last_error = str(e)
            logger.warning(
                "XML parsing attempt %d/%d failed: %s",
                attempt + 1,
                max_attempts,
                last_error,
            )
        except Exception as e:
            last_error = str(e)
            logger.warning(
                "AI call attempt %d/%d failed: %s",
                attempt + 1,
                max_attempts,
                last_error,
            )

    return None
