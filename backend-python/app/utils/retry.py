import asyncio
import logging
import random
from collections.abc import Callable, Coroutine
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def retry_with_backoff(
    fn: Callable[..., Coroutine[Any, Any, T]],
    *args: Any,
    max_retries: int = 5,
    base_delay: float = 1.0,
    jitter: float = 0.5,
    **kwargs: Any,
) -> T:
    """Call an async function with exponential backoff + jitter on failure.

    Retry schedule:
      Retry 1: wait base_delay * 1  + random(0, jitter)
      Retry 2: wait base_delay * 2  + random(0, jitter)
      Retry 3: wait base_delay * 4  + random(0, jitter)
      ...
    """
    last_exception: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            return await fn(*args, **kwargs)
        except Exception as exc:
            last_exception = exc
            if attempt == max_retries:
                break
            delay = base_delay * (2**attempt) + random.uniform(0, jitter)
            logger.warning(
                "Attempt %d/%d failed: %s. Retrying in %.1fs...",
                attempt + 1,
                max_retries + 1,
                exc,
                delay,
            )
            await asyncio.sleep(delay)

    raise last_exception  # type: ignore[misc]
