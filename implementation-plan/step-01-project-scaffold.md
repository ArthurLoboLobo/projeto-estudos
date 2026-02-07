# Step 01: Python Backend Project Scaffold

**Status:** PENDING

**Prerequisites:** None

---

## Before you start

Read these files to understand the full project:
- `implementation-plan/improve.md` — the complete spec
- `CLAUDE.md` — current project overview

## Task

Create the `backend-python/` directory with a working FastAPI project scaffold. No business logic yet — just the skeleton that boots up and responds to a health check.

### What to create:

1. **`backend-python/app/main.py`** — FastAPI app with:
   - CORS middleware (read `ALLOWED_ORIGINS` from config)
   - A `GET /health` endpoint that returns `{"status": "ok"}`
   - Include routers (empty for now, just the structure)

2. **`backend-python/app/config.py`** — Pydantic Settings loading from `.env`:
   - `DATABASE_URL`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET`
   - `GEMINI_API_KEY` (replacing OPENROUTER_API_KEY — we now use Gemini SDK directly)
   - `PORT` (default 8080)
   - `ALLOWED_ORIGINS` (comma-separated string → list)

3. **`backend-python/app/database.py`** — SQLAlchemy async engine + session factory:
   - `create_async_engine` with the DATABASE_URL
   - `async_sessionmaker` for dependency injection
   - A `get_db` async generator dependency for FastAPI

4. **`backend-python/requirements.txt`** — All dependencies from `improve.md`

5. **`backend-python/.env.example`** — Template with all required env vars

6. **`backend-python/app/routers/__init__.py`** — Empty, just the package
7. **`backend-python/app/models/__init__.py`** — Empty, just the package
8. **`backend-python/app/schemas/__init__.py`** — Empty, just the package
9. **`backend-python/app/services/__init__.py`** — Empty, just the package
10. **`backend-python/app/utils/__init__.py`** — Empty, just the package

### Verify it works:

Run the server and confirm the health endpoint responds:
```bash
cd backend-python
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
# GET http://localhost:8080/health → {"status": "ok"}
```

## Acceptance Criteria

- [ ] `backend-python/` directory exists with the structure above
- [ ] `uvicorn app.main:app` starts without errors
- [ ] `GET /health` returns 200
- [ ] Config loads from `.env` via Pydantic Settings
- [ ] Database engine is created (connection test not required yet — DB might not be set up)
- [ ] All package directories exist with `__init__.py`

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below with:
   - Any decisions you made that deviate from the plan
   - Any issues encountered
   - Anything the next step should know

---

## Completion Notes

_To be filled by Claude after completing this step._
