# Step 16: Backend Tests

**Status:** PENDING

**Prerequisites:** Step 10 completed (full backend)

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — understand the full system
- All previous step completion notes — for any edge cases or decisions made

## Task

Write backend tests covering auth, authorization, chunking parser, and core flows.

### 1. Test Setup

Configure pytest for async tests:

- **`backend-python/conftest.py`** — shared fixtures:
  - Test database (use a separate test DB or SQLite in-memory if compatible)
  - FastAPI test client (`httpx.AsyncClient` with `app`)
  - Factory functions for creating test data
  - Mock AI client (returns predefined responses)

- **`backend-python/pytest.ini`** or **`pyproject.toml`** — pytest config:
  ```ini
  [tool.pytest.ini_options]
  asyncio_mode = "auto"
  ```

### 2. Auth Tests (`tests/test_auth.py`)

- Register with valid credentials → 200 + token
- Register with duplicate email → error
- Login with valid credentials → 200 + token
- Login with wrong password → 401
- Login with non-existent email → 401 (same error as wrong password)
- Access protected endpoint without token → 401
- Access protected endpoint with invalid token → 401
- Access protected endpoint with valid token → 200

### 3. Authorization Tests (`tests/test_authorization.py`)

- User A creates a session
- User B tries to access User A's session → 403
- User B tries to access User A's documents → 403
- User B tries to access User A's chats → 403
- User B tries to delete User A's session → 403
- Cascade delete: deleting a session deletes its documents, topics, chats, messages, chunks

### 4. Chunking Parser Tests (`tests/test_chunking_parser.py`)

Test the XML parser with various AI response formats:

- Pure theory document (only `<THEORETICAL_CONTENT>`, no `<PROBLEM>`)
- Pure problem document (only `<PROBLEM>` blocks, no `<THEORETICAL_CONTENT>`)
- Hybrid document (both theory and problems)
- Problem without solution
- Multiple problems
- `<RELATED_TOPICS>` with valid order_index values
- `<RELATED_TOPICS>` with invalid order_index → stripped silently
- Empty `<RELATED_TOPICS>`
- Malformed XML → parser handles gracefully (returns partial results or raises parseable error)

Use **fixture files** with sample AI responses:
- `tests/fixtures/theory_response.txt`
- `tests/fixtures/problem_response.txt`
- `tests/fixtures/hybrid_response.txt`
- `tests/fixtures/malformed_response.txt`

### 5. Core Flow Tests (`tests/test_flows.py`)

Test the happy path end-to-end (with mocked AI):

- Create session → upload document (mock extraction) → generate plan (mock AI) → save plan → create chunks (mock AI + embeddings) → send chat message (mock AI)
- Verify session status transitions: `UPLOADING → GENERATING_PLAN → EDITING_PLAN → CHUNKING → ACTIVE`
- Verify topics and chats are created correctly
- Verify chunks are stored with correct types and relationships

### 6. RAG Tests (`tests/test_rag.py`)

- Test interleaved selection logic (mock vector search results)
- Test token budget is respected
- Test parent chunk expansion for problem chunks
- Test deduplication (same parent not included twice)
- Test topic-specific vs general review retrieval

### 7. Mock AI Client

Create a mock that replaces the real AI client (OpenRouter) in tests:

```python
class MockAIClient:
    def __init__(self, responses: dict[str, str]):
        self.responses = responses  # key: prompt pattern → value: response

    async def generate_text(self, system_prompt, user_prompt):
        # Return predefined response based on prompt content
        ...
```

## Acceptance Criteria

- [ ] All tests pass with `pytest`
- [ ] Auth flow fully tested (register, login, token validation)
- [ ] Authorization tested (user isolation)
- [ ] XML parser tested with all document types + edge cases
- [ ] Core happy path tested end-to-end
- [ ] RAG retrieval logic tested
- [ ] No real AI API calls in tests (all mocked)
- [ ] Fixture files for sample AI responses

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
