# Step 09: RAG Retrieval Service

**Status:** PENDING

**Prerequisites:** Step 08 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 5 (Chat with AI / RAG), especially the RAG Retrieval Strategy section with the interleaved selection example
- `implementation-plan/step-08-chunking-service.md` — read the Completion Notes

## Task

Implement the RAG retrieval service that finds relevant chunks for a user's chat message.

### 1. RAG Service (`app/services/rag.py`)

#### Query Embedding:

- **Topic-specific chats:** Embed `"{topic_title}: {user_message}"` — the topic scopes the search naturally
- **General review chats:**
  - If user message is short (< 20 tokens): generate a brief conversation summary via Gemini and embed `"{summary}: {user_message}"`
  - Otherwise: embed the user message directly

#### Vector Search Functions:

```python
async def search_chunks_local(
    session_id: UUID,
    topic_id: UUID,
    query_embedding: list[float],
    limit: int = 6,
    db: AsyncSession
) -> list[DocumentChunk]:
    """Search chunks where related_topic_ids contains topic_id, ordered by similarity."""

async def search_chunks_global(
    session_id: UUID,
    query_embedding: list[float],
    limit: int = 3,
    db: AsyncSession
) -> list[DocumentChunk]:
    """Search all chunks in session, ordered by similarity."""
```

Use pgvector's cosine distance operator (`<=>`) for similarity search. Only search chunks where `embedding IS NOT NULL` (excludes parent problem chunks).

#### Interleaved Selection with Token Budget:

```python
async def retrieve_context(
    session_id: UUID,
    topic_id: Optional[UUID],  # None for general review
    query_embedding: list[float],
    token_budget: int = 3500,
    db: AsyncSession
) -> list[str]:
    """
    Returns assembled context strings ready to inject into the AI prompt.

    For topic-specific:
      - Run local (top 6) and global (top 3) searches in parallel
      - Interleave: L, L, G, L, L, G, ...
      - For each chunk:
        - If problem type → fetch parent chunk (full problem with headers)
        - Add to context if within token budget
        - Skip duplicates
      - Stop when budget exceeded

    For general review:
      - Run global search only (top 9)
      - Same token budget and parent expansion logic

    Returns list of context strings (theory chunk text or full parent problem text).
    """
```

#### Parent Chunk Expansion:

When a child chunk (problem type) matches:
1. Fetch the parent chunk via `parent_chunk_id`
2. Use the parent's `chunk_text` (which contains the full problem with headers)
3. Count the parent's tokens against the budget (not the child's)
4. If any other child of the same parent was already included, skip (dedup by parent)

#### Context Assembly:

For each selected chunk, prepend the document's `file_description` (from the `documents` table):
```
[Source: Cálculo I - Prova 3 - 2022/2 - UFRJ]
<chunk text here>
```

For problem parent chunks, the `[File: ...]` header is already in the chunk text, so don't duplicate it.

## Acceptance Criteria

- [ ] Vector search works with pgvector cosine distance
- [ ] Topic-specific: interleaved local/global selection (2:1 ratio)
- [ ] General review: global-only search
- [ ] Token budget respected (stops before exceeding)
- [ ] Problem chunks expanded to full parent
- [ ] Deduplication by parent chunk
- [ ] Query embedding prepends topic title (topic chats) or summary (review chats)
- [ ] Context strings include source attribution

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
