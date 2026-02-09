import asyncio
import logging
import subprocess
import tempfile
from pathlib import Path
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.document import Document, ProcessingStatus
from app.services.storage import get_signed_url
from app.utils.retry import retry_with_backoff

logger = logging.getLogger(__name__)

VISION_MODEL = "gemini-2.5-flash"
MAX_CONCURRENT_PAGES = 20

VISION_EXTRACTION_PROMPT = """You are extracting content from an academic document page.

Extract ALL text from this page exactly as shown, preserving the original language.

For any mathematical formulas, equations, chemical formulas, or scientific notation:
- Represent them in LaTeX format using $...$ for inline math and $$...$$ for block equations
- Preserve the exact meaning and structure of the formulas

For tables:
- Format them clearly with proper alignment

For bullet points and numbered lists:
- Preserve the structure

Output the extracted content in plain text with LaTeX formulas embedded where appropriate.
Do not add any commentary or explanations - just extract the content as-is."""


async def _extract_page_text(image_path: Path, page_index: int) -> str:
    """Extract text from a single page image using Gemini Vision."""
    import google.generativeai as genai

    from app.config import settings

    genai.configure(api_key=settings.OPENROUTER_API_KEY)

    image_data = image_path.read_bytes()

    async def _call_vision() -> str:
        model = genai.GenerativeModel(VISION_MODEL)
        response = await model.generate_content_async(
            [
                VISION_EXTRACTION_PROMPT,
                {"mime_type": "image/png", "data": image_data},
            ]
        )
        return response.text

    text = await retry_with_backoff(_call_vision, max_retries=5, base_delay=1.0, jitter=0.5)
    logger.info("Page %d extracted (%d chars)", page_index + 1, len(text))
    return text


def _pdf_to_images(pdf_path: Path, output_dir: Path) -> list[Path]:
    """Convert PDF to PNG images using pdftoppm. Returns sorted list of image paths."""
    output_prefix = output_dir / "page"
    result = subprocess.run(
        [
            "pdftoppm",
            "-png",
            "-r", "150",  # 150 DPI — good balance of quality and size
            str(pdf_path),
            str(output_prefix),
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"pdftoppm failed: {result.stderr}")

    page_files = sorted(output_dir.glob("*.png"))
    if not page_files:
        raise RuntimeError("No pages extracted from PDF")

    return page_files


async def extract_text_from_pdf(pdf_path: Path) -> str:
    """Convert PDF to images and extract text from each page using Vision AI.

    Pages are processed in parallel with a concurrency semaphore.
    """
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        page_files = await asyncio.to_thread(_pdf_to_images, pdf_path, tmp)

        logger.info("Extracted %d pages from PDF, starting vision extraction", len(page_files))

        semaphore = asyncio.Semaphore(MAX_CONCURRENT_PAGES)

        async def _bounded_extract(img: Path, idx: int) -> tuple[int, str]:
            async with semaphore:
                text = await _extract_page_text(img, idx)
                return idx, text

        tasks = [_bounded_extract(img, idx) for idx, img in enumerate(page_files)]
        results = await asyncio.gather(*tasks)

        # Sort by page index (they may complete out of order)
        results.sort(key=lambda r: r[0])
        parts = [f"--- Page {idx + 1} ---\n{text}" for idx, text in results]
        return "\n\n".join(parts)


async def process_document_background(document_id: UUID, storage_path: str) -> None:
    """Background task: download PDF, extract text, update DB status.

    Uses its own DB session since FastAPI background tasks run after the
    response has been sent (the request session is closed).
    """
    async with async_session() as db:
        try:
            # Set status to PROCESSING
            await db.execute(
                update(Document)
                .where(Document.id == document_id)
                .values(processing_status=ProcessingStatus.PROCESSING)
            )
            await db.commit()

            # Download from Supabase Storage via signed URL
            signed_url = await get_signed_url(storage_path)

            import httpx

            async with httpx.AsyncClient() as client:
                resp = await client.get(signed_url)
                resp.raise_for_status()
                pdf_bytes = resp.content

            # Write to temp file and extract
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmp:
                tmp.write(pdf_bytes)
                tmp.flush()
                extracted_text = await extract_text_from_pdf(Path(tmp.name))

            # Update DB with extracted text
            await db.execute(
                update(Document)
                .where(Document.id == document_id)
                .values(
                    content_text=extracted_text,
                    content_length=len(extracted_text),
                    processing_status=ProcessingStatus.COMPLETED,
                )
            )
            await db.commit()
            logger.info("Document %s processing complete (%d chars)", document_id, len(extracted_text))

        except Exception:
            logger.exception("Document %s processing failed", document_id)
            await db.execute(
                update(Document)
                .where(Document.id == document_id)
                .values(processing_status=ProcessingStatus.FAILED)
            )
            await db.commit()
