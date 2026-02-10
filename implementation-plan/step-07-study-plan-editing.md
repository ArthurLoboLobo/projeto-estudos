# Step 07: Study Plan Editing + Start Studying

**Status:** COMPLETED

**Prerequisites:** Step 06 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 3 (Edit Study Plan)
- `implementation-plan/step-06-study-plan-generation.md` — read the Completion Notes

## Task

Implement the endpoints for editing the draft plan and finalizing it (creating topics + chats in the database).

### 1. Plan Editing Schemas (`app/schemas/plan.py`)

- `DraftTopic(order_index: int, title: str, subtopics: list[str], is_completed: bool = False)`
- `DraftPlan` — list of `DraftTopic`
- `SavePlanRequest(topics: list[DraftTopic])` — the final plan from the frontend
- `RevisePlanRequest(instruction: str)` — user's instruction for AI modification

### 2. Plan Revision Service (extend `app/services/study_plan.py`)

Add a function to revise the plan via AI:

```python
async def revise_plan(current_plan: list[dict], instruction: str, language: str) -> list[dict]:
    # Send current plan + user instruction to AI (via OpenRouter)
    # AI returns the modified plan in the same JSON format
    # Return the updated plan
```

The prompt should tell the AI to modify the plan according to the user's instruction while keeping the same JSON format.

### 3. Plan Endpoints (extend `app/routers/sessions.py`)

- **`GET /sessions/{id}/plan`**: Get current draft plan
  - Return `session.draft_plan`

- **`PUT /sessions/{id}/plan`**: Save final plan and start studying
  - Receive the final plan from frontend (user may have edited it)
  - Verify session status is `EDITING_PLAN`
  - Create `Topic` rows for each topic where `is_completed == false`
  - Create a `Chat` (type: `TOPIC_SPECIFIC`) for each created topic
  - Create one `Chat` (type: `GENERAL_REVIEW`) for the session
  - Update session status to `CHUNKING`
  - Return the created topics

- **`POST /sessions/{id}/revise-plan`**: Ask AI to modify the plan
  - Verify session status is `EDITING_PLAN`
  - Call the revision service
  - Update `session.draft_plan` with the revised plan
  - Return the updated plan

### Important: Topic creation logic

Create `Topic` + `Chat` rows for **ALL** topics (including completed ones). Completed topics are created with `is_completed = true` — the student can still open the chat and unmark the topic later. This means every topic in the plan gets a real database row and a chat.

Store the full plan in `session.draft_plan` even after starting — the chunking step will read it from there.

### 4. Plan History / Undo (`plan_history` JSONB column)

Add a `plan_history` JSONB column (default `[]`) to `study_sessions`. This stores previous plan snapshots for undo:

- **On every plan change** (`revise-plan`, `update-plan`): push the current `draft_plan` to `plan_history` before overwriting
- **`POST /sessions/{id}/undo-plan`**: pop the last snapshot from `plan_history`, set it as `draft_plan`
- **`POST /sessions/{id}/update-plan`**: save manual frontend edits (with history push)
- **`GET /sessions/{id}/plan`**: return `can_undo: bool` so frontend knows if undo button is enabled
- **`PUT /sessions/{id}/plan` (finalize)**: clear `plan_history` — no longer needed

## Acceptance Criteria

- [x] `GET /sessions/{id}/plan` returns the draft plan + `can_undo` flag
- [x] `POST /sessions/{id}/revise-plan` calls AI and updates the draft (with history push)
- [x] `POST /sessions/{id}/update-plan` saves manual frontend edits (with history push)
- [x] `POST /sessions/{id}/undo-plan` restores the previous plan snapshot
- [x] `PUT /sessions/{id}/plan` creates topics + chats and transitions to `CHUNKING`
- [x] ALL topics get `Topic` + `Chat` rows (completed ones start marked)
- [x] A `GENERAL_REVIEW` chat is created for the session
- [x] `draft_plan` is preserved (for chunking phase to reference)
- [x] `plan_history` cleared on finalize
- [x] Authorization checks on all endpoints

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

### Files created

- **`app/schemas/plan.py`** — Pydantic schemas:
  - `DraftTopic(order_index, title, subtopics, is_completed=False)`
  - `DraftPlan` — type alias for `list[DraftTopic]`
  - `SavePlanRequest(topics)` — final plan for `PUT /plan`
  - `UpdatePlanRequest(topics)` — manual edits for `POST /update-plan`
  - `PlanResponse(topics, can_undo)` — response for `GET /plan`
  - `RevisePlanRequest(instruction)` — AI revision instruction

- **`alembic/versions/9d1ce31fb5d4_add_plan_history_to_study_sessions.py`** — Migration adding `plan_history JSONB NOT NULL DEFAULT '[]'` to `study_sessions`

### Files modified

- **`app/models/session.py`** — Added `plan_history: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")`

- **`app/prompts.py`** — Added `PLAN_REVISION_SYSTEM_PROMPT` and `PLAN_REVISION_USER_PROMPT_TEMPLATE`

- **`app/services/study_plan.py`** — Added `revise_plan()` function

- **`app/routers/sessions.py`** — Five plan-related endpoints:
  - **`GET /plan`**: Returns `PlanResponse(topics, can_undo)` — current draft plan + whether undo history exists
  - **`POST /revise-plan`**: AI-assisted modification. Pushes current plan to `plan_history` before overwriting with AI result.
  - **`POST /update-plan`**: Saves manual frontend edits. Pushes current plan to `plan_history` before overwriting.
  - **`POST /undo-plan`**: Pops last snapshot from `plan_history`, sets it as `draft_plan`. Returns 400 if history is empty.
  - **`PUT /plan`**: Finalizes plan — creates `Topic` + `Chat` rows for ALL topics (completed ones start with `is_completed=True`), creates one `GENERAL_REVIEW` chat, transitions to `CHUNKING`, clears `plan_history`.

### Design decisions

- **All topics get DB rows**: Changed from "skip completed topics" to "create all topics with their `is_completed` status". This lets the student open any topic's chat and unmark it later. The completed flag is just a starting state, not a permanent exclusion.

- **Undo via `plan_history` JSONB column**: Chose a JSONB array on `study_sessions` over a separate table or frontend-only state. Each plan snapshot is ~2-5 KB, and users won't make more than ~20 edits, so ~100 KB max. Persists across page refreshes. Cleared on finalize to avoid carrying dead weight.

- **History push pattern**: Both `revise-plan` and `update-plan` push the current `draft_plan` to `plan_history` before overwriting. This means every change is undoable. The `undo-plan` endpoint simply pops the last item and restores it.

- **`update-plan` vs `PUT /plan`**: `POST /update-plan` saves intermediate manual edits (with undo history). `PUT /plan` is the final save that creates DB rows and transitions status. This separation is important — the frontend calls `update-plan` on each user action (delete topic, reorder, toggle completion, etc.) and `PUT /plan` only when the user clicks "Continue".

### Next step considerations

- Step 08 (chunking) reads `session.draft_plan` to get the full topic list for `<RELATED_TOPICS>` mapping. All topics (including completed) are in the draft plan.
- The `CHUNKING` status set by `PUT /plan` signals the frontend to navigate to the chunking phase.
- The migration (`9d1ce31fb5d4`) must be run on the database before deploying.
