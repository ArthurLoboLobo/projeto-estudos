# Step 05: Document Upload + Text Extraction

**Status:** PENDING

**Prerequisites:** Step 04 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 1 (Upload Materials) and the PDF processing pipeline
- `implementation-plan/step-04-session-crud.md` — read the Completion Notes
- `backend/src/services/documents/ingestion.rs` — reference the existing Rust text extraction logic
- `backend/src/services/documents/storage_client.rs` — reference the existing Supabase storage client
- `backend/src/prompts.rs` — reference the vision extraction prompt

## Task

Implement document upload to Supabase Storage, document listing/deletion, and the Vision AI text extraction pipeline.

### 1. Supabase Storage Service (`app/services/storage.py`)

- `upload_file(file_path: str, file_bytes: bytes, content_type: str) -> str` — upload to Supabase Storage bucket `documents`, return storage path
- `delete_file(file_path: str)` — delete from storage
- `get_signed_url(file_path: str) -> str` — generate a temporary signed URL for download

### 2. Text Extraction Service (`app/services/documents.py`)

Port the existing Rust logic to Python:

- Convert PDF to images using `pdftoppm` (subprocess call, same as current Rust impl)
- For each page image, call Gemini Vision API to extract text (preserve LaTeX formulas)
- Process pages in parallel (use `asyncio.gather` with a semaphore to limit concurrency)
- Concatenate results into final `content_text`
- Include the retry logic with exponential backoff + jitter (see `improve.md`)

Use the `google-generativeai` SDK directly (not OpenRouter). Model: `gemini-2.5-flash`.

### 3. Pydantic Schemas (`app/schemas/document.py`)

- `DocumentResponse(id, session_id, file_name, file_path, file_description, content_text, content_length, processing_status, created_at)`
- `DocumentUrlResponse(url: str)`

### 4. Document Router (`app/routers/documents.py`)

- **`POST /sessions/{id}/documents`**: Upload a PDF
  - Accept multipart file upload
  - Validate: file is PDF, size <= 25MB, session total <= 150MB
  - Verify session ownership and session status is `UPLOADING`
  - Upload to Supabase Storage
  - Create document row (status: PENDING)
  - Start text extraction as a **background task** (`BackgroundTasks` from FastAPI)
  - Background task: set status PROCESSING → extract text → set status COMPLETED (or FAILED)
  - Return document immediately (client polls for status updates)

- **`GET /sessions/{id}/documents`**: List documents for a session
  - Verify session ownership

- **`DELETE /sessions/{id}/documents/{doc_id}`**: Delete a document
  - Verify session ownership
  - Delete from Supabase Storage + database

- **`GET /documents/{id}/url`**: Get signed download URL
  - Verify the document belongs to a session owned by current user

### 5. Retry Utility (`app/utils/retry.py`)

Create a generic retry decorator/function with exponential backoff + jitter:
```python
async def retry_with_backoff(fn, max_retries=5, base_delay=1.0, jitter=0.5):
    ...
```

This will be reused by text extraction, plan generation, chunking, and chat.

### 6. Register router in main.py

## Acceptance Criteria

- [ ] PDF upload stores file in Supabase and creates DB row
- [ ] File size validation (25MB per file, 150MB per session)
- [ ] Text extraction runs in background and updates document status
- [ ] Vision API extracts text with LaTeX preservation
- [ ] Retry utility with exponential backoff + jitter works
- [ ] Document listing and deletion work with authorization
- [ ] Signed URL generation works

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
