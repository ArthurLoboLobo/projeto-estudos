import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.config import settings
from app.utils.retry import retry_with_backoff

logger = logging.getLogger(__name__)


async def generate_text(system_prompt: str, user_prompt: str, model: str) -> str:
    """Single completion via OpenRouter (OpenAI-compatible API).

    Wrapped with exponential backoff + jitter retry logic.
    """

    async def _call() -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    return await retry_with_backoff(_call, max_retries=5, base_delay=1.0, jitter=0.5)


async def generate_text_stream(
    system_prompt: str, user_prompt: str, model: str
) -> AsyncIterator[str]:
    """Streaming completion via OpenRouter. Yields text chunks as they arrive.

    Note: No retry wrapper — the caller should handle reconnection if needed,
    since partial results have already been sent to the client.
    """
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": True,
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[len("data: "):]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
