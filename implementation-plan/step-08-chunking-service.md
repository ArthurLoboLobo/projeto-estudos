# Step 08: Chunking Service (Document Analysis + Chunk Creation)

**Status:** PENDING

**Prerequisites:** Step 07 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 4 (Create Chunks), Chunking Strategy, AI Response Format, and Error Handling sections thoroughly
- `implementation-plan/step-07-study-plan-editing.md` — read the Completion Notes

## Task

Implement the chunking pipeline: call Gemini to analyze each document, parse the XML response, create chunks (theory + problem), compute embeddings, and store everything.

### 1. XML Parser (`app/services/chunking.py`)

Parse the AI's XML-like response into structured data. Use **regex-based extraction** (more resilient than strict XML parsing for LLM output):

```python
@dataclass
class TheoreticalContent:
    related_topic_indices: list[int]  # order_index values
    content: str

@dataclass
class Problem:
    description: str
    related_topic_indices: list[int]
    statement: str
    solution: Optional[str]

@dataclass
class DocumentAnalysis:
    file_description: str
    theoretical_content: Optional[TheoreticalContent]
    problems: list[Problem]
```

Parse `<FILE_DESCRIPTION>`, `<THEORETICAL_CONTENT>`, `<PROBLEM>` blocks using regex.

### 2. Chunk Creation Logic (`app/services/chunking.py`)

#### For theoretical content → overlapping chunks:
- Split `<CONTENT>` text into chunks of ~400 tokens with ~20% overlap (~80 tokens)
- Each chunk gets `type = 'theory'`
- `related_topic_ids`: map `order_index` values → actual topic UUIDs
- `parent_chunk_id`: null (flat structure)

#### For problems → hierarchical chunks:
- Create **parent chunk** with the full problem text (with headers):
  ```
  [File: <FILE_DESCRIPTION>]
  [Problem: <DESCRIPTION>]
  [Statement]
  <STATEMENT text>
  [Solution]
  <SOLUTION text>
  ```
- Parent chunk: `type = 'problem'`, `embedding = null` (not embedded)
- Split parent into **child chunks** (~300-500 tokens)
- Each child: `type = 'problem'`, `parent_chunk_id` → parent's ID, embedded

#### order_index → UUID mapping:
- Read the full draft plan from `session.draft_plan`
- Build a map: `{order_index: topic_uuid}` from the topics table
- If a `<RELATED_TOPICS>` value doesn't match any `order_index` → set `related_topic_ids` to empty (don't fail)

### 3. Embedding Service (`app/services/embeddings.py`)

- Use Gemini `text-embedding-004` model (768 dimensions)
- `embed_text(text: str) -> list[float]`
- `embed_texts(texts: list[str]) -> list[list[float]]` — batch embedding
- Wrap with retry logic

### 4. Chunking Pipeline (`app/services/chunking.py`)

Main orchestration function:

```python
async def process_document_for_chunks(doc: Document, topics: list[Topic], plan: list[dict], language: str, db: AsyncSession):
    # 1. Call Gemini to analyze document → get XML response
    # 2. Parse XML response (with retry: max 3 attempts, include error in retry prompt)
    # 3. If all 3 parsing attempts fail → fall back to simple overlapping chunks (no topic linking)
    # 4. Create theory chunks (overlapping)
    # 5. Create problem chunks (hierarchical: parent + children)
    # 6. Compute embeddings for all embeddable chunks
    # 7. Save all chunks to database
```

### 5. SSE Endpoint (extend `app/routers/sessions.py`)

- **`GET /sessions/{id}/create-chunks`**: SSE endpoint
  - Verify session ownership and status is `CHUNKING`
  - Process all documents in parallel (`asyncio.gather` with semaphore)
  - Stream progress: `{"event": "document_chunked", "data": {"doc": 2, "total": 5}}`
  - On completion: update session status to `ACTIVE`, send `completed` event
  - On error: update status back to `EDITING_PLAN` for retry
  - Also save `file_description` from the AI response to `documents.file_description`

### 6. Token Counting Utility (`app/utils/tokens.py`)

Create a simple token estimation function for chunking:
```python
def estimate_tokens(text: str) -> int:
    # Simple heuristic: ~4 characters per token for mixed language content
    # Or use a proper tokenizer if available
```

## Acceptance Criteria

- [ ] XML parser handles all document types (pure theory, pure problems, hybrid)
- [ ] Theory chunks: overlapping, ~400 tokens, with topic linking
- [ ] Problem chunks: hierarchical (parent not embedded, children embedded)
- [ ] Embeddings computed via Gemini text-embedding-004
- [ ] Retry logic: max 3 attempts for XML parsing, fallback to simple chunks
- [ ] Invalid order_index references stripped silently
- [ ] SSE streams chunking progress
- [ ] Session status: `CHUNKING` → `ACTIVE` on success, → `EDITING_PLAN` on failure
- [ ] `file_description` saved to documents table

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
