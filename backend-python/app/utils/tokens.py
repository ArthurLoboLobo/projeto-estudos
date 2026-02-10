def estimate_tokens(text: str) -> int:
    """Estimate the number of tokens in a text string.

    Uses a simple heuristic of ~4 characters per token, which works
    reasonably well for mixed-language content (English, Portuguese, etc.).
    """
    return max(1, len(text) // 4)
