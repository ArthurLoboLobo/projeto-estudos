# Step 06: Study Plan Generation (SSE Streaming)

**Status:** COMPLETED

**Prerequisites:** Step 05 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 2 (Generate Study Plan) and the AI prompt behavior section
- `implementation-plan/step-05-document-upload.md` — read the Completion Notes
- `backend/src/prompts.rs` — reference the existing plan generation prompt (adapt for new format)
- `backend/src/services/planning/mod.rs` — reference the existing Rust planning logic

## Task

Implement the incremental study plan generation endpoint that streams progress via SSE.

### 1. OpenRouter AI Client (`app/services/ai_client.py`)

Create a reusable AI client using OpenRouter via `httpx` (OpenAI-compatible API):
- Configure with `settings.OPENROUTER_API_KEY` and `settings.OPENROUTER_BASE_URL`
- Functions accept a `model` parameter so each caller passes the appropriate config value:
  - `generate_text(system_prompt: str, user_prompt: str, model: str) -> str` — single completion
  - `generate_text_stream(system_prompt: str, user_prompt: str, model: str) -> AsyncIterator[str]` — streaming (for chat, later)
- Callers pass the model from config: e.g., `generate_text(..., model=settings.MODEL_PLAN)`
- Wrap calls with the retry utility from step 05

This client will be reused by plan generation (`settings.MODEL_PLAN`), chunking (`settings.MODEL_CHUNKING`), chat (`settings.MODEL_CHAT`), summarization (`settings.MODEL_SUMMARY`), and plan revision (`settings.MODEL_PLAN`).

### 2. Plan Generation Service (`app/services/study_plan.py`)

Implement the incremental plan generation:

```python
async def generate_plan_stream(session_id: UUID, db: AsyncSession) -> AsyncIterator[dict]:
    documents = await get_completed_documents(session_id, db)
    current_plan = []

    for i, doc in enumerate(documents):
        # AI receives: current plan + document text
        # AI returns: updated plan (JSON)
        updated_plan = await call_ai_for_plan(current_plan, doc.content_text, language)
        current_plan = updated_plan

        yield {
            "event": "document_processed",
            "data": {"doc": i + 1, "total": len(documents), "plan": current_plan}
        }

    # Save final plan to session.draft_plan
    # Update session status to EDITING_PLAN
    yield {"event": "completed", "data": {"plan": current_plan}}
```

### AI Prompt Design:

The prompt should instruct the AI to:
- Receive the current plan (JSON) and a new document's text
- Return an updated plan in the exact JSON format: `[{order_index, title, subtopics: [...]}]`
- Follow the behaviors from `improve.md`: create, merge, split, reorder topics as needed
- Respond in the user's language (from `x-language` header)

### 3. SSE Endpoint (`app/routers/sessions.py`)

Add to the sessions router:

- **`GET /sessions/{id}/generate-plan`**: SSE endpoint
  - Verify session ownership
  - Verify session status is `UPLOADING` and at least 1 document has `COMPLETED` status
  - Update session status to `GENERATING_PLAN`
  - Return `StreamingResponse` with `media_type="text/event-stream"`
  - Stream events as the plan is built document by document
  - On completion, save `draft_plan` to session and update status to `EDITING_PLAN`
  - On error, update status back to `UPLOADING` so user can retry

### SSE Format:

```
event: document_processed
data: {"doc": 1, "total": 3, "plan": [...]}

event: document_processed
data: {"doc": 2, "total": 3, "plan": [...updated...]}

event: document_processed
data: {"doc": 3, "total": 3, "plan": [...final...]}

event: completed
data: {"plan": [...final...]}
```

## Acceptance Criteria

- [x] OpenRouter AI client works with retry logic
- [x] Plan is built incrementally (one document at a time)
- [x] SSE endpoint streams progress events to the client
- [x] Final plan is saved to `session.draft_plan` as JSONB
- [x] Session status transitions: `UPLOADING` → `GENERATING_PLAN` → `EDITING_PLAN`
- [x] Error handling: status reverts to `UPLOADING` on failure
- [x] Plan format matches `improve.md`: `[{order_index, title, subtopics: [...]}]`

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

- **Files created:**
  - `app/services/ai_client.py` — Reusable OpenRouter AI client with two functions:
    - `generate_text(system_prompt, user_prompt, model) -> str`: Single completion call wrapped with `retry_with_backoff(max_retries=5, base_delay=1.0, jitter=0.5)`. Uses `httpx.AsyncClient` with 120s timeout. Posts to `{OPENROUTER_BASE_URL}/chat/completions` with system + user messages.
    - `generate_text_stream(system_prompt, user_prompt, model) -> AsyncIterator[str]`: Streaming completion for future use (chat). Parses SSE `data:` lines from OpenRouter, yields content deltas. No retry wrapper since partial results have already been sent.
  - `app/services/study_plan.py` — Incremental plan generation service:
    - `generate_plan_stream(session_id, db, language) -> AsyncIterator[dict]`: Fetches all COMPLETED documents ordered by `created_at`. For each document, sends the current plan + document text to the AI (`settings.MODEL_PLAN`). The AI returns an updated plan in `[{order_index, title, subtopics}]` format. Yields `document_processed` events after each document and a `completed` event at the end. Saves `draft_plan` as JSONB and transitions session to `EDITING_PLAN`.
    - `_parse_plan_json(response)`: Handles markdown code blocks in AI responses, validates the JSON array structure (checks for required fields: `order_index`, `title`, `subtopics`).
    - Language mapping: `LANGUAGE_NAMES` dict converts header code (e.g., `"pt"`) to full name (e.g., `"Portuguese"`) for AI prompts — same pattern as the Rust backend's `language_name()`.
- **Files modified:**
  - `app/routers/sessions.py` — Added `GET /sessions/{session_id}/generate-plan` SSE endpoint:
    - Validates session ownership, status is `UPLOADING`, and at least 1 document has `COMPLETED` processing status (uses `func.count()` query).
    - Transitions to `GENERATING_PLAN` before streaming begins.
    - Returns `StreamingResponse` with `media_type="text/event-stream"` and `Cache-Control: no-cache`.
    - Error handling: on exception inside the stream, performs `db.rollback()`, reloads the session, reverts status to `UPLOADING`, and sends an `error` SSE event.
    - Added imports: `json`, `logging`, `HTTPException`, `StreamingResponse`, `func`, `get_language`, `Document`, `ProcessingStatus`, `generate_plan_stream`.
- **Design decisions:**
  - **AI prompt adapted for new format:** The Rust backend's `GENERATE_PLAN_PROMPT` used `{id, title, description, status}` format. The new prompt uses `{order_index, title, subtopics[]}` as specified in `improve.md`. The prompt explicitly instructs the AI to return only a JSON array (no wrapping object), to keep `order_index` sequential from 1, and to follow the merge/split/reorder behaviors from `improve.md`.
  - **`generate_text` vs inline httpx calls:** The `documents.py` service makes direct httpx calls for Vision API (multimodal requests with images). The new `ai_client.py` handles text-only completions. The Vision calls were left as-is since they have a different request shape (image content).
  - **Error handling in SSE:** Since the response has already started streaming (HTTP 200 sent), errors during generation can't change the status code. Instead, an `error` SSE event is sent. The session status is reverted to `UPLOADING` via `db.rollback()` + fresh load + commit, ensuring the user can retry.
  - **`generate_plan_stream` accepts `language` parameter:** Added as a third parameter (not in the step's pseudocode signature) because the AI needs the language from the `x-language` header to generate content in the user's language.
  - **Route ordering:** The `/{session_id}/generate-plan` route is placed after `/{session_id}` and `DELETE /{session_id}`. FastAPI correctly distinguishes these because `/generate-plan` is a literal path suffix, not a path parameter.
