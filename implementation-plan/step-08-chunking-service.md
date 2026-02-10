# Step 08: Chunking Service (Document Analysis + Chunk Creation)

**Status:** COMPLETED

**Prerequisites:** Step 07 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 4 (Create Chunks), Chunking Strategy, AI Response Format, and Error Handling sections thoroughly
- `implementation-plan/step-07-study-plan-editing.md` — read the Completion Notes

## Task

Implement the chunking pipeline: call the AI (via OpenRouter) to analyze each document, parse the XML response, create chunks (theory + problem), compute embeddings, and store everything.

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
- Build a map: `{order_index: topic_uuid}` from the topics table (ALL topics exist in DB, including completed ones — step 07 creates rows for every topic)
- If a `<RELATED_TOPICS>` value doesn't match any `order_index` → set `related_topic_ids` to empty (don't fail)

### 3. Embedding Service (`app/services/embeddings.py`)

- Use `settings.MODEL_EMBEDDING` (default: `google/gemini-embedding-001`) via OpenRouter
- Endpoint: `{settings.OPENROUTER_BASE_URL}/embeddings`
- Request `output_dimensionality: 768` to match the DB `VECTOR(768)` column
- `embed_text(text: str) -> list[float]`
- `embed_texts(texts: list[str]) -> list[list[float]]` — batch embedding
- Wrap with retry logic

### 4. Chunking Pipeline (`app/services/chunking.py`)

Main orchestration function:

```python
async def process_document_for_chunks(doc: Document, topics: list[Topic], plan: list[dict], language: str, db: AsyncSession):
    # 1. Call AI via ai_client.generate_text(..., model=settings.MODEL_CHUNKING) → get XML response
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

- [x] XML parser handles all document types (pure theory, pure problems, hybrid)
- [x] Theory chunks: overlapping, ~400 tokens, with topic linking
- [x] Problem chunks: hierarchical (parent not embedded, children embedded)
- [x] Embeddings computed via `settings.MODEL_EMBEDDING` (default: `google/gemini-embedding-001`, 768 dims)
- [x] Retry logic: max 3 attempts for XML parsing, fallback to simple chunks
- [x] Invalid order_index references stripped silently
- [x] SSE streams chunking progress
- [x] Session status: `CHUNKING` → `ACTIVE` on success, → `EDITING_PLAN` on failure
- [x] `file_description` saved to documents table

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

### Files created

- **`app/utils/tokens.py`** — Simple token estimation heuristic (~4 chars per token). Used by the chunking service to determine chunk boundaries.

- **`app/services/embeddings.py`** — Embedding service with two functions:
  - `embed_text(text)` — single text embedding
  - `embed_texts(texts)` — batch embedding via OpenRouter's `/embeddings` endpoint
  - Uses `settings.MODEL_EMBEDDING` (default: `google/gemini-embedding-001`)
  - Requests 768 dimensions to match `VECTOR(768)` DB column
  - Wrapped with `retry_with_backoff` (5 retries, exponential backoff + jitter)

- **`app/services/chunking.py`** — Full chunking pipeline:
  - **Data classes**: `TheoreticalContent`, `Problem`, `DocumentAnalysis`
  - **XML parser**: Regex-based extraction of `<FILE_DESCRIPTION>`, `<THEORETICAL_CONTENT>`, `<PROBLEM>` blocks. Resilient to LLM output quirks.
  - **Theory chunks**: Overlapping (~400 tokens, ~80 token overlap), flat structure, with topic linking via `order_index → UUID` mapping
  - **Problem chunks**: Hierarchical — parent chunk has full problem text with `[File:]`, `[Problem:]`, `[Statement]`, `[Solution]` headers; children are split from parent (~400 tokens, no overlap). Parent is NOT embedded, only children are.
  - **Fallback chunks**: When all 3 XML parsing attempts fail, creates simple overlapping chunks from raw document text (no topic linking, no problem/theory distinction)
  - **Pipeline orchestration**: `process_document_for_chunks()` does AI call → parse XML (with retry) → create chunks → compute embeddings → save to DB
  - **`_analyze_document_with_retry()`**: 3 attempts max, includes parse error in retry prompt

### Files modified

- **`app/prompts.py`** — Added three prompt constants:
  - `CHUNKING_SYSTEM_PROMPT` — instructs AI to analyze documents and return structured XML format
  - `CHUNKING_USER_PROMPT_TEMPLATE` — includes language, study plan (formatted as numbered list), document text, and detailed XML format instructions
  - `CHUNKING_RETRY_PROMPT_TEMPLATE` — includes the specific parse error from the previous attempt

- **`app/routers/sessions.py`** — Added `GET /sessions/{id}/create-chunks` SSE endpoint:
  - Verifies session ownership and `CHUNKING` status
  - Deletes any existing chunks for idempotent restart (handles interrupted processes)
  - Processes documents sequentially (streams `document_chunked` event after each)
  - On success: transitions to `ACTIVE`, sends `completed` event
  - On error: reverts status to `EDITING_PLAN` for retry
  - Individual document failures are logged but don't abort the entire process

### Design decisions

- **Sequential document processing instead of parallel**: The step spec suggested `asyncio.gather` with semaphore, but since all document processing shares the same SQLAlchemy async session (from the FastAPI dependency), concurrent DB operations would be unsafe. Sequential processing is correct and the AI API calls are the bottleneck anyway. Each document still processes fully (AI call + parse + embed + save) before moving to the next.

- **Embedding error tolerance**: If embedding computation fails for a document, chunks are still saved without embeddings rather than failing the entire pipeline. This is more resilient — the chunks can still be used for keyword-based retrieval, and embeddings can potentially be recomputed later.

- **Text splitting strategy**: Splits at paragraph boundaries first (`\n\n`), falls back to sentence boundaries for very large paragraphs. Overlap is achieved by keeping trailing paragraphs from the previous chunk.

- **Embedding request uses `dimensions: 768`** instead of `output_dimensionality: 768` — the OpenAI-compatible API uses the `dimensions` parameter name (OpenRouter follows the OpenAI spec).

### Next step considerations

- Step 09 (RAG retrieval) will query `document_chunks` by `session_id` and `related_topic_ids`, using vector similarity search on the `embedding` column. The `parent_chunk_id` relationship is key for retrieving full problems when a child chunk matches.
- The `file_description` saved on documents can be used as context prefix when assembling RAG results for the chat.
- The `CHUNKING` → `ACTIVE` transition signals the frontend to navigate to the study page.
