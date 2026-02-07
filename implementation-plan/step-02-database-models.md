# Step 02: Database Models + Alembic Migrations

**Status:** PENDING

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

_To be filled by Claude after completing this step._
