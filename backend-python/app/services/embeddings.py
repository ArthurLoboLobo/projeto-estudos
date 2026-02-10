import logging

import httpx

from app.config import settings
from app.utils.retry import retry_with_backoff

logger = logging.getLogger(__name__)


async def embed_text(text: str) -> list[float]:
    """Compute an embedding for a single text string via OpenRouter."""
    results = await embed_texts([text])
    return results[0]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Compute embeddings for a batch of texts via OpenRouter.

    Uses the OpenAI-compatible embeddings endpoint with retry logic.
    Returns one embedding vector (768 dimensions) per input text.
    """

    async def _call() -> list[list[float]]:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.MODEL_EMBEDDING,
                    "input": texts,
                    "dimensions": 768,
                },
            )
            response.raise_for_status()
            data = response.json()
            # Sort by index to preserve input order
            sorted_data = sorted(data["data"], key=lambda x: x["index"])
            return [item["embedding"] for item in sorted_data]

    return await retry_with_backoff(_call, max_retries=5, base_delay=1.0, jitter=0.5)
