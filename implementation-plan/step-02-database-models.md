# Step 02: Database Models + Alembic Migrations

**Status:** COMPLETED

**Prerequisites:** Step 01 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see the "Database Schema" section for all table definitions
- `implementation-plan/step-01-project-scaffold.md` — read the Completion Notes for any relevant context

## Task

Create all SQLAlchemy models matching the schema in `improve.md` and set up Alembic for migrations.

### 1. Initialize Alembic

```bash
cd backend-python
alembic init alembic
```

Configure `alembic/env.py` to use async SQLAlchemy engine and import all models.

### 2. Create SQLAlchemy Models

Create one model file per table in `backend-python/app/models/`:

- **`profile.py`** — `Profile` model (id, email, password_hash, created_at)
- **`session.py`** — `StudySession` model (id, profile_id FK, title, description, status enum, draft_plan JSONB, timestamps)
- **`document.py`** — `Document` model (id, session_id FK, file_name, file_path, file_description, content_text, content_length, processing_status enum, created_at)
- **`topic.py`** — `Topic` model (id, session_id FK, title, subtopics as ARRAY(Text), order_index, is_completed, timestamps)
- **`chat.py`** — `Chat` model (id, session_id FK, type enum, topic_id FK nullable, is_started, timestamps, unique constraint on topic_id)
- **`message.py`** — `Message` model (id, chat_id FK, role with check constraint, content, created_at)
- **`chunk.py`** — `DocumentChunk` model (id, document_id FK, session_id FK, parent_chunk_id self-FK nullable, chunk_text, embedding as Vector(768), type enum, related_topic_ids as ARRAY(UUID), created_at)

### Important details from the schema:

- Use PostgreSQL enums (SQLAlchemy `Enum` type) for: `session_status`, `processing_status`, `chat_type`, `chunk_type`
- Session status values: `UPLOADING`, `GENERATING_PLAN`, `EDITING_PLAN`, `CHUNKING`, `ACTIVE`, `COMPLETED`
- Use `pgvector` SQLAlchemy integration for the `Vector(768)` column
- All FKs have `ON DELETE CASCADE`
- The `vector` extension must be enabled — include this in the initial migration

### 3. Export all models

Update `backend-python/app/models/__init__.py` to import all models (needed for Alembic auto-detection).

### 4. Generate and review migration

```bash
alembic revision --autogenerate -m "initial schema"
```

Review the generated migration file to make sure it matches the schema in `improve.md`. Make sure it creates the `vector` extension and all indexes (especially the HNSW index on embeddings and the GIN index on related_topic_ids).

## Acceptance Criteria

- [ ] All 7 model files created with correct columns, types, and constraints
- [ ] Enums defined as PostgreSQL enums
- [ ] Vector(768) column on DocumentChunk using pgvector
- [ ] Alembic configured for async
- [ ] Migration file generated and matches the schema in `improve.md`
- [ ] All indexes from the schema are included (especially HNSW and GIN)

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

- **Migration written manually** instead of using `--autogenerate`, because autogenerate requires a live DB connection. The migration file (`alembic/versions/5ac214bfd3bf_initial_schema.py`) was hand-written to exactly match the schema in `improve.md`, including all indexes, enums, constraints, and the `vector` extension.
- **HNSW index** on `document_chunks.embedding` and **GIN index** on `document_chunks.related_topic_ids` are created via raw `op.execute()` SQL in the migration because Alembic's `op.create_index` doesn't fully support these PostgreSQL-specific index types with WHERE clauses.
- **All 4 PostgreSQL enums** created: `session_status`, `processing_status`, `chat_type`, `chunk_type` — matching `improve.md` exactly.
- **Session default status is `UPLOADING`** (as specified in `improve.md`), not `PLANNING` (which was the old Rust backend's default in `CLAUDE.md`).
- **`alembic/env.py`** configured for async: uses `async_engine_from_config` + `asyncio.run()`. Reads `DATABASE_URL` from `app.config.settings` (overrides `alembic.ini`'s `sqlalchemy.url`).
- **Model relationships** are all set up with proper `back_populates` and `cascade="all, delete-orphan"` where appropriate.
- **DocumentChunk.embedding** uses `pgvector.sqlalchemy.Vector(768)` — note this column uses `mapped_column` without `Mapped[]` type annotation since pgvector's Vector type doesn't have a direct Python type equivalent.
- **All acceptance criteria met:** 7 model files, PostgreSQL enums, Vector(768), async Alembic, migration matches schema, all indexes included.
