# Step 04: Session CRUD Endpoints

**Status:** PENDING

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

- [ ] All 4 CRUD endpoints work with proper auth
- [ ] Authorization check prevents accessing other users' sessions
- [ ] New sessions default to `UPLOADING` status
- [ ] Delete cascades correctly
- [ ] Reusable `get_authorized_session` helper exists

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
