# Step 06: Study Plan Generation (SSE Streaming)

**Status:** PENDING

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

- [ ] OpenRouter AI client works with retry logic
- [ ] Plan is built incrementally (one document at a time)
- [ ] SSE endpoint streams progress events to the client
- [ ] Final plan is saved to `session.draft_plan` as JSONB
- [ ] Session status transitions: `UPLOADING` → `GENERATING_PLAN` → `EDITING_PLAN`
- [ ] Error handling: status reverts to `UPLOADING` on failure
- [ ] Plan format matches `improve.md`: `[{order_index, title, subtopics: [...]}]`

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
