# Step 07: Study Plan Editing + Start Studying

**Status:** PENDING

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
    # Send current plan + user instruction to Gemini
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

- [ ] `GET /sessions/{id}/plan` returns the draft plan
- [ ] `POST /sessions/{id}/revise-plan` calls AI and updates the draft
- [ ] `PUT /sessions/{id}/plan` creates topics + chats and transitions to `CHUNKING`
- [ ] Only non-completed topics get `Topic` rows and `Chat` rows
- [ ] A `GENERAL_REVIEW` chat is created for the session
- [ ] `draft_plan` is preserved (for chunking phase to reference)
- [ ] Authorization checks on all endpoints

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
