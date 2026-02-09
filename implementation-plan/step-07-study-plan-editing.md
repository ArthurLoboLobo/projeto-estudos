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

Only create topics for items where `is_completed == false` (user marked "already know" topics should be skipped). But ALL topics (including completed ones) should be passed to the chunking phase later, because the AI needs the full plan context for `<RELATED_TOPICS>` mapping.

Store the full plan (including completed topics) in `session.draft_plan` even after starting — the chunking step will read it from there.

## Acceptance Criteria

- [x] `GET /sessions/{id}/plan` returns the draft plan
- [x] `POST /sessions/{id}/revise-plan` calls AI and updates the draft
- [x] `PUT /sessions/{id}/plan` creates topics + chats and transitions to `CHUNKING`
- [x] Only non-completed topics get `Topic` rows and `Chat` rows
- [x] A `GENERAL_REVIEW` chat is created for the session
- [x] `draft_plan` is preserved (for chunking phase to reference)
- [x] Authorization checks on all endpoints

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

- **Files created:**
  - `app/schemas/plan.py` — Pydantic schemas for plan editing:
    - `DraftTopic(order_index, title, subtopics, is_completed)`: Represents a topic in the draft plan before DB persistence. Includes `is_completed` flag to mark topics the user already knows.
    - `DraftPlan`: Type alias for `list[DraftTopic]` for cleaner type hints.
    - `SavePlanRequest(topics)`: Request body for `PUT /sessions/{id}/plan`. Contains the final edited plan from the frontend.
    - `RevisePlanRequest(instruction)`: Request body for `POST /sessions/{id}/revise-plan`. Contains the user's natural language instruction for AI modification (e.g., "merge topics 3 and 4").

- **Files modified:**
  - `app/prompts.py` — Added plan revision prompts:
    - `PLAN_REVISION_SYSTEM_PROMPT`: Instructs AI to act as an academic tutor modifying a study plan based on user instruction. Enforces JSON-only output (no markdown, no explanations).
    - `PLAN_REVISION_USER_PROMPT_TEMPLATE`: Template with `{language}`, `{current_plan}`, and `{instruction}` placeholders. Instructs AI to follow the user's modification request (merge, split, reorder, add, delete) while maintaining plan quality (sequential order_index, at least 2 subtopics per topic, specific and actionable subtopics).

  - `app/services/study_plan.py` — Added plan revision function:
    - `async def revise_plan(current_plan, instruction, language) -> list[dict]`: Sends current plan + user instruction to AI via `generate_text()`. AI returns the modified plan in the same `[{order_index, title, subtopics}]` format. Uses `_parse_plan_json()` to validate the response structure. Wrapped with retry logic (inherited from `generate_text()`). Logs the number of topics in the revised plan.
    - Added imports for the new prompts (`PLAN_REVISION_SYSTEM_PROMPT`, `PLAN_REVISION_USER_PROMPT_TEMPLATE`).

  - `app/routers/sessions.py` — Added three endpoints:
    - **`GET /sessions/{session_id}/plan`**: Returns `session.draft_plan`. Validates session ownership via `get_authorized_session()`. Returns 404 if no draft plan exists (user must generate first).

    - **`POST /sessions/{session_id}/revise-plan`**: AI-assisted plan modification. Validates session status is `EDITING_PLAN`. Calls `revise_plan()` service function with current plan + user instruction + language. Updates `session.draft_plan` with the revised plan. Returns the revised plan to the frontend.

    - **`PUT /sessions/{session_id}/plan`**: Finalizes the plan and starts studying. Validates session status is `EDITING_PLAN`. Updates `session.draft_plan` with the final edited version from the frontend (preserves ALL topics, including completed ones, for chunking phase). Creates database rows:
      - **Topics**: Creates `Topic` rows ONLY for items where `is_completed == false`. Each topic includes `session_id`, `title`, `subtopics`, `order_index`, and `is_completed` (set to false). Uses `db.flush()` after adding each topic to get the `topic.id` before creating the chat.
      - **Topic chats**: Creates one `Chat` (type: `TOPIC_SPECIFIC`) for each created topic. Links via `topic_id`.
      - **General review chat**: Creates one `Chat` (type: `GENERAL_REVIEW`) with `topic_id=None` for the session.
    - Transitions session status to `CHUNKING`. Returns a summary: `{message, topics_created, total_topics}`.

    - Added imports: `Chat`, `ChatType`, `Topic`, `DraftPlan`, `RevisePlanRequest`, `SavePlanRequest`, `revise_plan`.

- **Design decisions:**
  - **Draft plan preservation**: The `PUT /sessions/{id}/plan` endpoint updates `session.draft_plan` with the final frontend state (including completed topics) before creating Topic rows. This ensures the chunking phase (Step 08) can read the full plan from `session.draft_plan` and use all topics (even completed ones) for `<RELATED_TOPICS>` mapping. Completed topics are NOT created as Topic rows, so they won't appear in the study interface.

  - **Plan revision vs. plan generation prompts**: The revision prompt is similar to the generation prompt but focuses on user-driven modifications rather than document-driven updates. The revision prompt explicitly mentions merge/split/reorder operations and emphasizes following the user's instruction exactly.

  - **Authorization pattern**: All three endpoints use `get_authorized_session()` to verify the user owns the session. This prevents cross-user data access (same pattern as previous endpoints).

  - **Status validation**: `POST /revise-plan` and `PUT /plan` both require session status to be `EDITING_PLAN`. This prevents users from modifying the plan after it's been finalized (topics created). The `GET /plan` endpoint has no status requirement since it's read-only.

  - **Async flush pattern**: The `PUT /plan` endpoint uses `await db.flush()` after adding each `Topic` to immediately get the generated `topic.id` before creating the associated `Chat`. This is more efficient than using `db.refresh()` and allows batch committing at the end.

  - **Chat creation order**: Topic-specific chats are created in the same loop as topics, then the general review chat is created once after the loop. This ensures all chats are created in a single transaction with the session status update.

- **Testing notes:**
  - Verified all imports work correctly with `./venv/bin/python -c "from ... import ..."`.
  - Plan schemas, revision function, and router all import without errors.
  - The prompts follow the same pattern as existing prompts (centralized in `app/prompts.py`).

- **Next step considerations:**
  - Step 08 (chunking) will read `session.draft_plan` to get the full topic list (including completed topics) for `<RELATED_TOPICS>` mapping.
  - The `CHUNKING` status set by `PUT /plan` signals that the frontend should navigate to the chunking phase.
