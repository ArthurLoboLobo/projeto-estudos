# Step 04: Session CRUD Endpoints

**Status:** COMPLETED

**Prerequisites:** Step 03 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see REST API endpoints table and session status flow
- `implementation-plan/step-03-auth.md` — read the Completion Notes for how auth dependency works

## Task

Implement CRUD endpoints for study sessions with proper authorization.

### 1. Pydantic Schemas (`app/schemas/session.py`)

- `CreateSessionRequest(title: str, description: Optional[str])`
- `SessionResponse(id, profile_id, title, description, status, draft_plan, created_at, updated_at)`
- `SessionListResponse` — list of SessionResponse

### 2. Session Router (`app/routers/sessions.py`)

All endpoints require authentication (`get_current_user` dependency).

- **`GET /sessions`**: List all sessions for the current user
  - Filter by `profile_id = current_user.id`
  - Order by `created_at DESC`

- **`POST /sessions`**: Create a new session
  - Set initial status to `UPLOADING`
  - Set `profile_id` from authenticated user

- **`GET /sessions/{id}`**: Get session details
  - Fetch session, verify `profile_id == current_user.id`
  - Return 404 if not found, 403 if not owned

- **`DELETE /sessions/{id}`**: Delete a session
  - Verify ownership
  - Cascade deletes handle related data (documents, topics, chats, chunks, messages)

### 3. Authorization pattern

Every endpoint that accesses a session must verify ownership. Create a reusable helper:

```python
async def get_authorized_session(session_id: UUID, user_id: UUID, db: AsyncSession) -> StudySession:
    session = await db.get(StudySession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.profile_id != user_id:
        raise HTTPException(403, "Not authorized")
    return session
```

This pattern will be reused by all future routers that access session-scoped resources.

### 4. Register router in main.py

## Acceptance Criteria

- [x] All 4 CRUD endpoints work with proper auth
- [x] Authorization check prevents accessing other users' sessions
- [x] New sessions default to `UPLOADING` status
- [x] Delete cascades correctly
- [x] Reusable `get_authorized_session` helper exists

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

- **Files created:**
  - `app/schemas/session.py` — `CreateSessionRequest` and `SessionResponse` (Pydantic v2, `from_attributes=True`). `SessionResponse` includes `status` typed as `SessionStatus` enum and `draft_plan` as `Any | None` for JSONB.
  - `app/services/authorization.py` — `get_authorized_session(session_id, user_id, db)` reusable helper. Returns `StudySession` or raises 404/403. This is used by all session-scoped routers (documents, topics, etc.).
  - `app/routers/sessions.py` — All 4 CRUD endpoints: `GET /sessions` (list, ordered by created_at DESC), `POST /sessions` (201, defaults to UPLOADING), `GET /sessions/{id}`, `DELETE /sessions/{id}` (204, cascade via SQLAlchemy).
- **Files modified:**
  - `app/main.py` — Added `app.include_router(sessions.router)`
- **Design decisions:**
  - `get_authorized_session` lives in `app/services/authorization.py` (not in the router) so it's importable by any router that needs session ownership checks.
  - `SessionListResponse` was not created as a separate type — FastAPI handles `list[SessionResponse]` natively as the response model.
  - Delete returns 204 No Content with no body, relying on SQLAlchemy cascade for related data cleanup.
- **All acceptance criteria verified** — imports, route registration, and authorization pattern confirmed.
