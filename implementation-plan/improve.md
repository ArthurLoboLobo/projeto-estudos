# Caky - AI Improvements Plan

This document describes how the AI parts of this project will be improved.

---

## Implementation Sessions

Each session corresponds to one or more step files in this folder. Complete them in order, committing after each session.

| Session | Step Files | Description |
|---------|-----------|-------------|
| 1 | Steps 01 + 02 | Project scaffold + SQLAlchemy models + Alembic |
| 2 | Step 03 | Auth (register, login, JWT, Argon2) |
| 3 | Steps 04 + 05 | Session CRUD + document upload + text extraction |
| 4 | Step 06 | Study plan generation (SSE streaming) |
| 5 | Step 07 | Study plan editing + start studying endpoints |
| 6 | Step 08 | Chunking service (XML parsing, embeddings) |
| 7 | Step 09 | RAG retrieval service |
| 8 | Step 10 | Chat endpoints with RAG + streaming |
| 9 | Steps 11 + 12 | Frontend API client setup + Auth/Dashboard migration |
| 10 | Step 13 | Frontend upload page migration |
| 11 | Step 14 | Frontend plan generation + editing pages |
| 12 | Step 15 | Frontend study page + streaming chat |
| 13 | Step 16 | Backend tests |

**How to use:** At the start of each session, tell Claude:
> "Read `implementation-plan/improve.md` and `implementation-plan/step-XX-<name>.md`. Implement what the step file describes. When done, edit the step file to mark it completed and write your completion notes."

---

## Overview: The New Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  1. UPLOAD MATERIALS                                                     │
│     • User uploads files (PDFs)                                          │
│     • Each file: shows upload progress → extracting text → ready ✓       │
│     • User can delete files                                              │
│     • Click "Finish" when done                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  2. GENERATE STUDY PLAN (background, user sees progress)                 │
│     • For each document: AI updates the study plan incrementally         │
│     • User sees: "Processing document 2/5..." + plan evolving in real-time│
│     • When done → automatically go to next page                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  3. EDIT STUDY PLAN (user interaction)                                   │
│     • User reviews the generated plan                                    │
│     • Can: toggle completion, delete, add, edit, reorder topics          │
│     • Can: ask AI to modify the plan via chat                            │
│     • Undo/redo available                                                │
│     • Click "Continue" when done                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  4. CREATE CHUNKS (background, for RAG)                                  │
│     • Process all documents in parallel                                  │
│     • AI analyzes each document and returns structured response          │
│     • Theoretical content → overlapping chunks                           │
│     • Problems → hierarchical chunks (parent + children)                 │
│     • Link chunks to related topics (by topic ID)                        │
│     • When done → go to study page                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  5. STUDY (existing flow continues)                                      │
│     • Topic cards, chat with AI, etc.                                    │
│     • Chat uses RAG to retrieve relevant chunks                          │
│     • Chat responses streamed via SSE                                    │
│     • Long conversations: summarize older messages, keep last 6-8        │
└─────────────────────────────────────────────────────────────────────────┘

Session status flow:
UPLOADING → GENERATING_PLAN → EDITING_PLAN → CHUNKING → ACTIVE → COMPLETED
```

---

## Phase 1: Upload Materials

### What happens:
1. User uploads PDF files
2. For each file:
   - Show upload progress: "Uploading..." → "Extracting text..." → "Ready ✓"
   - AI extracts text using Vision API (already implemented)
3. User can delete uploaded files
4. When user clicks **"Finish"**, proceed to study plan generation

### File Size Limits:
- **Per file:** 25MB max
- **Per session:** 150MB total (sum of all uploaded files)

### UI Elements:
- File list with status badges
- "Finish" button (disabled until at least 1 file is ready and there is no file uploading or extracting)

---

## Phase 2: Generate Study Plan

### Communication: SSE (Server-Sent Events)

The backend streams progress to the frontend via SSE (`text/event-stream`). This gives a real-time feel without WebSockets:

- **Backend:** FastAPI `StreamingResponse` with `text/event-stream` content type
- **Frontend:** Native `EventSource` API (no library needed)
- Events sent: `{"event": "document_processed", "data": {"doc": 2, "total": 5, "plan": [...]}}`
- When the last event arrives, frontend automatically navigates to the edit page

### What happens:
1. Start with an empty study plan: `[]`
2. For each document:
   - AI receives: current study plan + extracted text
   - AI returns: updated study plan
3. User sees the plan evolving as each document is processed (via SSE)
4. When all documents are processed → automatically go to edit page

### Study Plan Format (Draft):

During generation, topics use `order_index` for ordering:

```json
[
  {
    "order_index": 1,
    "title": "Derivatives",
    "subtopics": [
      "Definition of derivative as a limit",
      "Differentiation rules (sum, product, quotient)",
      "Chain rule",
      "Derivative of trigonometric functions"
    ]
  },
  {
    "order_index": 2,
    "title": "Integrals",
    "subtopics": [
      "Definite and indefinite integrals",
      "Integration by substitution",
      "Integration by parts"
    ]
  }
]
```

**Note:** The draft uses `order_index` for ordering only. When topics are saved to the database (end of Phase 3), they receive UUIDs. During chunking (Phase 4), the AI receives topics **from the database** with their UUIDs and uses those UUIDs in `<RELATED_TOPICS>`.

### AI Prompt Behavior:
- Create new topics when new concepts appear
- Add subtopics to existing topics when related content appears
- Update topic titles if a better name emerges
- Reorder topics if the document suggests a different sequence
- Merge topics if they are too granular
- Split topics if they are too broad

---

## Phase 3: Edit Study Plan

### User Actions:
| Action | Description |
|--------|-------------|
| **Toggle completion** | Mark topic as "already know" / "need to study" |
| **Delete topic** | Remove a topic (order updates automatically) |
| **Add topic** | Insert a new topic at any position (order updates automatically) |
| **Edit topic** | Change title, add/remove/edit subtopics |
| **Reorder topics** | Drag-and-drop to change order |
| **Ask AI** | Chat with AI to modify the plan (e.g., "merge topics 3 and 4") |

### UX Features:
- **Undo**: Backend persists previous plan snapshots in `plan_history` JSONB column — survives page refreshes. Every edit (manual or AI revision) pushes the current plan to history before overwriting. Undo pops the last snapshot.
- **Drag-and-drop**: For reordering topics
- **Inline editing**: Click subtopic to edit in place
- **Add subtopic**: "+" button at end of subtopic list
- **Delete subtopic**: "×" button on hover
- **AI chat box**: Small chat interface for AI modifications. **Lock the plan UI while AI is processing** to prevent conflicts between manual edits and AI modifications.
- **Validation**: Warn if any topic has no subtopics, or if there are 0 topics

### When user clicks "Continue":
- Create `Topic` + `Chat` rows for **ALL** topics (completed ones start with `is_completed=True` — student can unmark later)
- Clear `plan_history` (no longer needed)
- Study plan becomes read-only
- Proceed to chunk creation

---

## Phase 4: Create Chunks (for RAG)

### Communication: SSE (Server-Sent Events)

Same SSE pattern as Phase 2. The backend streams chunking progress:
- Events: `{"event": "document_chunked", "data": {"doc": 2, "total": 5}}`
- When the last event arrives, frontend navigates to the study page

### What happens:
1. Process all documents **in parallel**
2. For each document:
   - AI receives: extracted text + study plan with `order_index` values
   - AI analyzes the document and returns a **structured response** (see format below)
   - We parse the response and create appropriate chunks
3. Link chunks to related topics (backend maps `order_index` → UUID)
4. When all documents are processed → go to study page

### Rate Limiting:

Processing multiple documents in parallel might trigger 429 (Too Many Requests) errors. We use **exponential backoff + jitter**:

```
Retry 1: wait 1s + random(0-500ms)
Retry 2: wait 2s + random(0-500ms)
Retry 3: wait 4s + random(0-500ms)
Retry 4: wait 8s + random(0-500ms)
Retry 5: fail permanently
```

- **Max retries:** 5 attempts
- **Jitter:** Random 0-500ms added to prevent thundering herd
- **Applies to:** All AI API calls (text extraction, study plan generation, chunking)

### AI Response Format (XML-like):

The AI returns a structured response that separates theoretical content from problems. The AI receives the study plan with `order_index` values and uses those in `<RELATED_TOPICS>`.

**Important:** `<RELATED_TOPICS>` uses **order_index integers** (e.g., `1, 2`), not UUIDs or topic names. This:
- Saves tokens (~40x fewer than UUIDs)
- Reduces hallucination risk (AI handles small integers better than hex strings)
- The backend maps these indices back to the actual Topic UUIDs before saving

```xml
<FILE_DESCRIPTION>
Cálculo I - Prova 3 - 2022/2 - UFRJ
</FILE_DESCRIPTION>

<THEORETICAL_CONTENT>
<RELATED_TOPICS>1, 2</RELATED_TOPICS>
<CONTENT>
A derivada de uma função representa a taxa de variação instantânea...

A regra da cadeia estabelece que para uma função composta f(g(x)), 
a derivada é f'(g(x)) · g'(x)...
</CONTENT>
</THEORETICAL_CONTENT>

<PROBLEM>
<DESCRIPTION>
Questão 5 - 15 pontos
Prova 3 de Cálculo I, 2022/2, UFRJ
</DESCRIPTION>
<RELATED_TOPICS>1</RELATED_TOPICS>
<STATEMENT>
Calcule a derivada de f(x) = sin(x²). Mostre todos os passos.
</STATEMENT>
<SOLUTION>
Usando a regra da cadeia:
Seja u = x², então f(x) = sin(u)
f'(x) = cos(u) · u' = cos(x²) · 2x = 2x·cos(x²)
</SOLUTION>
</PROBLEM>

<PROBLEM>
<DESCRIPTION>
Questão 6 - 20 pontos
Prova 3 de Cálculo I, 2022/2, UFRJ
</DESCRIPTION>
<RELATED_TOPICS>2</RELATED_TOPICS>
<STATEMENT>
Calcule a integral de ∫ x·cos(x²) dx.
</STATEMENT>
<SOLUTION>
Usando substituição:
Seja u = x², então du = 2x dx, logo x dx = du/2
∫ x·cos(x²) dx = ∫ cos(u) · (du/2) = (1/2)·sin(u) + C = (1/2)·sin(x²) + C
</SOLUTION>
</PROBLEM>
```

### Response Format Details:

| Tag | Required | Description |
|-----|----------|-------------|
| `<FILE_DESCRIPTION>` | Yes | General description of the file (subject, exam name, year, university, etc.) |
| `<THEORETICAL_CONTENT>` | No | Theoretical/explanatory content. Omitted for pure problem documents. |
| `<RELATED_TOPICS>` | No | Comma-separated list of **order_index** values. Null if content doesn't match any topic. |
| `<CONTENT>` | Yes (inside THEORETICAL_CONTENT) | The actual theoretical text |
| `<PROBLEM>` | No | One block per problem. Omitted for pure theory documents. |
| `<DESCRIPTION>` | Yes (per problem) | Free-form description of the problem context (number, points, etc.) |
| `<STATEMENT>` | Yes (per problem) | The problem statement |
| `<SOLUTION>` | No | The solution. Omitted if not present in the document. |

### Document Type Handling:

| Document Type | AI Response |
|---------------|-------------|
| Pure theory (slides, book) | `<FILE_DESCRIPTION>` + `<THEORETICAL_CONTENT>`, no `<PROBLEM>` tags |
| Pure problems (exam) | `<FILE_DESCRIPTION>` + multiple `<PROBLEM>` tags, no `<THEORETICAL_CONTENT>` |
| Hybrid (slides with exercises) | `<FILE_DESCRIPTION>` + `<THEORETICAL_CONTENT>` + `<PROBLEM>` tags |

---

## Chunking Strategy

### For Theoretical Content → Overlapping Chunks

From the `<THEORETICAL_CONTENT>` section, create overlapping chunks:

#### Storage:
- **`chunk_text`**: Just the content (pure text, no headers)
- **`related_topic_ids`**: Array of topic UUIDs from `<RELATED_TOPICS>`
- **`file_description`**: Stored in the parent `documents` table

**Why no header in chunk text?**
- Keeps embeddings focused on actual content (better semantic matching)
- File context is stored in metadata, not repeated in every chunk
- When retrieving for RAG, we combine: `documents.file_description` + `chunk_text`

#### Parameters:
- Chunk size: ~400 tokens
- Overlap: ~20% (~80 tokens)
- Each chunk is embedded directly (no parent-child structure)

---

### For Problems → Hierarchical Chunking

From each `<PROBLEM>` block, create a parent chunk and child chunks:

#### Parent Chunk Structure:
The parent chunk contains the complete problem as text with headers:

```
[File: Cálculo I - Prova 3 - 2022/2 - UFRJ]

[Problem: Questão 5 - 15 pontos]

[Statement]
Calcule a derivada de f(x) = sin(x²). Mostre todos os passos.

[Solution]
Usando a regra da cadeia:
Seja u = x², então f(x) = sin(u)
f'(x) = cos(u) · u' = cos(x²) · 2x = 2x·cos(x²)
```

**Notes:**
- The `[File: ...]` header comes from `<FILE_DESCRIPTION>`
- The `[Problem: ...]` header comes from `<DESCRIPTION>`
- Solution is included only if present
- Multi-part problems (5a, 5b, 5c) are stored as ONE parent chunk
- Parent chunk is **NOT embedded** (only stored for retrieval)

#### Child Chunks:
- Parent chunk is split into fixed-size chunks (~300-500 tokens)
- Each child has `parent_chunk_id` pointing to its parent
- Only child chunks are embedded in the vector database
- Children do NOT have headers (just raw content for better embedding)

#### Retrieval:
1. User query → embed → search child chunks
2. When child matches → retrieve entire parent chunk
3. Send complete problem (with headers) to AI as context

---

## Phase 5: Chat with AI (RAG)

### Chat Streaming:

Chat responses are streamed to the frontend via **SSE**. This is the industry standard for LLM streaming (used by ChatGPT, Claude, etc.):
- Backend streams tokens as they arrive from the AI model (via OpenRouter)
- Frontend renders tokens incrementally

### Context Window Management:

To prevent long conversations from overflowing the model's context window, we use a **summarization strategy**:

- Keep the **last 6-8 messages** (3-4 exchanges) verbatim — this preserves the immediate conversation flow
- Summarize everything older into a **rolling summary** (~200-300 tokens)
- Trigger summarization when message count exceeds **10 messages** (not on every request)

**Token budget breakdown:**
- System prompt + topic context: ~500 tokens
- RAG context: ~3500 tokens
- Conversation summary: ~300 tokens
- Recent messages (last 6-8): variable
- User's new message: variable
- Remaining: reserved for AI response

### Context Management:
The AI receives in the system prompt:
- The complete study plan
- The current topic being studied
- Conversation summary (if conversation is long) + recent messages

**NOT included in system prompt:**
- Full document texts (would overflow context window)

### RAG Retrieval Strategy:

#### RAG Query Embedding:

The user's message must be **embedded** to perform vector search. For each `sendMessage` call:

- **Topic-specific chats:** Embed the user's last message prepended with the topic title (e.g., `"Derivatives: can you give me another example?"`). The topic already scopes the search, so no extra LLM call needed.
- **General review chats:** Embed the user's last message prepended with a **short conversation summary** (generated by LLM). This helps when the user's message is short/referential (e.g., "give me another one"). Only generate the summary when the last message is ambiguous (< 20 tokens).

#### General Review Chat:
- Perform vector search **without any topic filters**
- Search the entire session's knowledge base
- Select chunks until token budget is reached

#### Topic-Specific Chat:
Use a **hybrid approach** with interleaved selection:

1. **Run two searches in parallel:**
   - **Local**: Chunks where `related_topic_ids` contains current topic
   - **Global**: All chunks in session (no filter)

2. **Interleaved selection with token budget:**
   ```
   Token budget: ~3500 tokens
   
   Selection order: Local → Local → Global → Local → Local → Global → ...
   
   For each chunk:
     - If chunk.type == 'problem': get parent chunk (full problem)
     - Add chunk tokens to running total
     - If would exceed budget: STOP (don't add this chunk)
     - Skip if already added (deduplicate)
   ```
   Also, we can limit the total number of chunks initially retrieved to 9. That is, top 6 local and 3 global chunks.

3. **Why this pattern?**
   - **2:1 Local:Global ratio**: Prioritizes current topic content
   - **Interleaved**: Ensures we always get some global context (prerequisites)
   - **Token budget**: Handles variable chunk sizes (problems are bigger)

#### Example:
```
User: "How do I solve problem 5 from test 3?"
Token budget: 3500

Local search results:  [L1, L2, L3, L4, L5, L6]  (ordered by similarity)
Global search results: [G1, G2, G3]  (ordered by similarity)

Selection:
  L1 (theory, 400 tokens)  → total: 400   ✓
  L2 (problem → parent, 1200 tokens) → total: 1600  ✓
  G1 (theory, 400 tokens)  → total: 2000  ✓
  L3 (theory, 400 tokens)  → total: 2400  ✓
  L4 (problem → parent, 1000 tokens) → total: 3400  ✓
  G2 (theory, 400 tokens)  → would be 3800 > 3500  ✗ STOP

Final context: [L1, L2 (parent), G1, L3, L4 (parent)]
```

---

## Database Schema

All tables will be dropped and recreated. Run these SQL files in order:

### 001_extensions.sql
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 002_enums.sql
```sql
CREATE TYPE session_status AS ENUM ('UPLOADING', 'GENERATING_PLAN', 'EDITING_PLAN', 'CHUNKING', 'ACTIVE', 'COMPLETED');
CREATE TYPE processing_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE chat_type AS ENUM ('TOPIC_SPECIFIC', 'GENERAL_REVIEW');
CREATE TYPE chunk_type AS ENUM ('problem', 'theory');
```

### 003_profiles.sql
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 004_study_sessions.sql
```sql
CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status session_status NOT NULL DEFAULT 'UPLOADING',
    draft_plan JSONB,
    plan_history JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_profile ON study_sessions(profile_id);
```

### 005_documents.sql
```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_description TEXT,
    content_text TEXT,
    content_length INTEGER,
    processing_status processing_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_session ON documents(session_id);
```

### 006_topics.sql
```sql
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    subtopics TEXT[] NOT NULL DEFAULT '{}',
    order_index INTEGER NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_topics_session ON topics(session_id);
```

### 007_chats.sql
```sql
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    type chat_type NOT NULL,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    is_started BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_topic_chat UNIQUE (topic_id)
);

CREATE INDEX idx_chats_session ON chats(session_id);
```

### 008_messages.sql
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_messages_created ON messages(chat_id, created_at);
```

### 009_document_chunks.sql
```sql
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    parent_chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(768),
    type chunk_type NOT NULL,
    related_topic_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_session ON document_chunks(session_id);
CREATE INDEX idx_chunks_parent ON document_chunks(parent_chunk_id);
CREATE INDEX idx_chunks_type ON document_chunks(type);
CREATE INDEX idx_chunks_topics ON document_chunks USING GIN (related_topic_ids);
-- No vector index needed: exact scan (brute force) is fast enough for ~50-1000 chunks per session
```

---

## Error Handling

### AI XML Parsing (Chunking):
- If AI returns invalid XML → **retry up to 2 times** (3 total attempts), including the parsing error in the retry prompt: "Your previous response had invalid XML. Specifically: [error]. Please try again."
- If all 3 attempts fail → fall back to simple overlapping chunks (no problem/theory distinction, no topic linking)
- If `<RELATED_TOPICS>` references a non-existent `order_index` → strip silently (set `related_topic_ids` to empty) rather than retrying

### Interrupted Backend Processes:
If a background process (plan generation, chunking) is interrupted, use an **idempotent restart** strategy:
- **Phase 2 (plan generation) interrupted:** Regenerate from all documents. The user hasn't invested editing time yet, so restarting is cheap.
- **Phase 4 (chunking) interrupted:** Delete any chunks for that session (`DELETE FROM document_chunks WHERE session_id = ?`) and re-run. No user data is lost since chunking happens before the study phase.
- **Detection:** If the user loads a session with status `GENERATING_PLAN` or `CHUNKING`, show "Processing was interrupted" and offer a **"Retry" button**.

### General:
- If chunking fails after all retries → log error, allow user to retry or skip that document
- Rate limit errors (429) → handled by exponential backoff + jitter (see Phase 4)

---

## Backend Migration: Rust → Python

### Why Migrate?
- **Better AI ecosystem**: Easier AI integration via OpenRouter (OpenAI-compatible API)
- **Faster iteration**: No compile times, easier debugging
- **Simpler async**: FastAPI's async is straightforward for AI calls

### Stack Changes:

| Component | Current (Rust) | New (Python) |
|-----------|---------------|--------------|
| Web Framework | Axum | **FastAPI** |
| API Style | GraphQL (async-graphql) | **REST** |
| Database | SQLx | **SQLAlchemy** (async) + **asyncpg** |
| HTTP Client | reqwest | **httpx** |
| AI SDK | OpenRouter via HTTP | **OpenRouter via httpx** (OpenAI-compatible API) |
| Embeddings | N/A | **OpenRouter via httpx** (embedding endpoint) |

### Authorization (No Supabase RLS):

Since we're not using Row-Level Security, the backend must validate permissions on **every request**:

```python
# Every endpoint that accesses user data must verify ownership

async def get_session(session_id: UUID, current_user: User, db: AsyncSession):
    session = await db.get(StudySession, session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session.profile_id != current_user.id:  # ← Authorization check
        raise HTTPException(403, "Not authorized")
    return session

# Same pattern for documents, topics, chunks, chats, messages
```

**Authorization Flow:**
1. JWT token in `Authorization: Bearer <token>` header
2. Middleware extracts and validates token → gets `current_user`
3. Every DB query filters by or verifies `profile_id` ownership
4. Return 403 if user doesn't own the resource

### Project Structure:

```
backend-python/
├── app/
│   ├── main.py              # FastAPI app + middleware
│   ├── config.py            # Pydantic settings
│   ├── database.py          # SQLAlchemy async setup
│   │
│   ├── models/              # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── profile.py
│   │   ├── session.py
│   │   ├── document.py
│   │   ├── topic.py
│   │   ├── chunk.py
│   │   ├── chat.py
│   │   └── message.py
│   │
│   ├── schemas/             # Pydantic schemas (request/response)
│   │   ├── auth.py
│   │   ├── session.py
│   │   ├── document.py
│   │   ├── plan.py
│   │   └── ...
│   │
│   ├── routers/             # REST API routes
│   │   ├── auth.py          # POST /auth/register, POST /auth/login
│   │   ├── sessions.py      # CRUD /sessions
│   │   ├── documents.py     # POST /sessions/{id}/documents
│   │   ├── topics.py        # GET/PUT /sessions/{id}/topics
│   │   └── chat.py          # POST /chats/{id}/messages (streaming)
│   │
│   ├── services/            # Business logic
│   │   ├── auth.py          # JWT, password hashing
│   │   ├── documents.py     # File upload, text extraction
│   │   ├── study_plan.py    # AI study plan generation
│   │   ├── chunking.py      # Document → chunks
│   │   ├── embeddings.py    # OpenRouter embeddings
│   │   ├── rag.py           # Retrieval logic
│   │   └── chat.py          # AI chat with RAG
│   │
│   └── utils/
│       ├── retry.py         # Exponential backoff + jitter
│       └── tokens.py        # Token counting (tiktoken or similar)
│
├── alembic/                 # Database migrations
├── requirements.txt
├── .env
└── Dockerfile
```

### Key Dependencies:

```txt
# requirements.txt
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-jose[cryptography]>=3.3.0  # JWT
argon2-cffi>=23.1.0               # Password hashing (Argon2, same as current Rust backend)
httpx>=0.26.0                     # Async HTTP client
# AI calls go through OpenRouter via httpx (already listed above)
pgvector>=0.2.0                   # Vector types for SQLAlchemy
python-multipart>=0.0.6           # File uploads
alembic>=1.13.0                   # Migrations
supabase>=2.0.0                   # Supabase Storage client
pytest>=8.0.0                     # Testing
pytest-asyncio>=0.23.0            # Async test support
httpx>=0.26.0                     # Also used as FastAPI test client
```

### Model Configuration:

All AI models are configurable via environment variables. This makes it trivial to swap providers (e.g., Gemini → GPT-4o → Claude) — just change the `.env` value.

| Env Variable | Purpose | Default |
|-------------|---------|---------|
| `MODEL_VISION` | PDF page text extraction | `google/gemini-2.5-flash` |
| `MODEL_PLAN` | Study plan generation + revision | `google/gemini-2.5-flash` |
| `MODEL_CHUNKING` | Document analysis for chunks | `google/gemini-2.5-flash` |
| `MODEL_CHAT` | User chat responses | `google/gemini-2.5-flash` |
| `MODEL_SUMMARY` | Conversation summarization | `google/gemini-2.5-flash` |
| `MODEL_EMBEDDING` | Embedding generation (768 dims) | `google/gemini-embedding-001` |
| `OPENROUTER_BASE_URL` | API base URL | `https://openrouter.ai/api/v1` |

All models are accessed through OpenRouter's OpenAI-compatible API. To swap chat models, change the model string (e.g., `anthropic/claude-sonnet-4`, `openai/gpt-4o`). For embeddings, ensure the new model supports 768 dimensions or update the DB schema accordingly.

### REST API Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET | `/sessions` | List user's sessions |
| POST | `/sessions` | Create new session |
| GET | `/sessions/{id}` | Get session details |
| DELETE | `/sessions/{id}` | Delete session |
| POST | `/sessions/{id}/documents` | Upload document |
| DELETE | `/sessions/{id}/documents/{doc_id}` | Delete document |
| GET | `/sessions/{id}/documents` | List session documents |
| GET | `/sessions/{id}/generate-plan` | **SSE** — stream plan generation progress |
| GET | `/sessions/{id}/plan` | Get current draft plan + `can_undo` flag |
| POST | `/sessions/{id}/revise-plan` | Ask AI to modify the draft plan |
| POST | `/sessions/{id}/update-plan` | Save manual frontend edits (with undo history) |
| POST | `/sessions/{id}/undo-plan` | Restore previous plan snapshot |
| PUT | `/sessions/{id}/plan` | Finalize plan — create topics + chats, start chunking |
| GET | `/sessions/{id}/create-chunks` | **SSE** — stream chunking progress |
| GET | `/sessions/{id}/topics` | Get topics with completion status |
| PUT | `/topics/{id}` | Update topic (completion, etc.) |
| GET | `/sessions/{id}/chats` | List session chats |
| GET | `/chats/{id}` | Get chat details |
| POST | `/chats/{id}/messages` | **SSE** — send message, stream AI response |
| GET | `/chats/{id}/messages` | Get chat history |
| DELETE | `/chats/{id}/messages` | Clear chat history |

### Frontend Migration: GraphQL → REST

Hard cutover — replace Apollo Client with **TanStack Query (React Query) + fetch**:

| Aspect | Current | New |
|--------|---------|-----|
| Data fetching | Apollo Client | **TanStack Query** + `fetch` |
| Query hook | `useQuery(GET_SESSIONS)` | `useQuery({ queryKey: ['sessions'], queryFn: () => api.get('/sessions') })` |
| Mutation hook | `useMutation(CREATE_SESSION)` | `useMutation({ mutationFn: (data) => api.post('/sessions', data) })` |
| SSE streaming | N/A | Native `EventSource` API |
| Caching | Apollo InMemoryCache | TanStack Query cache (stale-while-revalidate) |

**Steps:**
1. Remove `@apollo/client` and all `gql` query/mutation strings
2. Add `@tanstack/react-query`, create a thin API client (`fetch` wrapper with auth headers + `x-language` header)
3. Replace all `useQuery` / `useMutation` calls
4. Add `EventSource` handling for SSE endpoints (plan generation, chunking, chat streaming)

### Testing:

- **pytest + httpx** for API integration tests (FastAPI's built-in test client)
- **Fixtures** with mock AI responses (saved XML/JSON files) for chunking and plan generation parsing
- **Factory functions** for creating test data (sessions, documents, topics, etc.)
- Test auth, authorization (user A can't access user B's data), and the core flows

### Migration Steps:

1. **Create** `backend-python/` directory
2. **Set up** FastAPI with SQLAlchemy async
3. **Port** database models (same schema, SQLAlchemy syntax)
4. **Implement** auth (JWT + Argon2, same as current)
5. **Implement** new features (study plan, chunking, RAG)
6. **Port** document upload & text extraction
7. **Update** frontend: remove Apollo Client, add TanStack Query + fetch + EventSource
8. **Write tests** (auth, authorization, chunking parser, core flows)
9. **Deploy** Python backend, retire Rust

---

## Summary of Changes from Current Implementation

| Aspect | Current | New |
|--------|---------|-----|
| Backend | Rust + Axum | Python + FastAPI |
| API | GraphQL (Apollo Client) | REST (TanStack Query + fetch) |
| Real-time | Polling | SSE (plan generation, chunking, chat streaming) |
| Study plan creation | All at once after upload | Incremental per document, streamed via SSE |
| Study plan format | `{ title, description }` | `{ order_index, title, subtopics[] }` |
| User editing | Limited | Full control: add, delete, edit, reorder, undo/redo |
| Document analysis | N/A | AI returns structured XML-like response per document |
| Topic linking | By name (error-prone) | By order_index → mapped to UUID |
| Chunking | Not implemented | Hierarchical for problems, overlapping for theory |
| Chat context | All documents in prompt | RAG with hybrid search + context window management |
| Chat history | Unlimited | Summarize older messages, keep last 6-8 verbatim |
| Problem retrieval | N/A | Complete problem via parent chunk |
| Embeddings | N/A | `google/gemini-embedding-001` via OpenRouter (768 dimensions) |
| Vector search | N/A | Exact scan (brute force) — fast enough for ~50-1000 chunks per session |
| AI models | Hardcoded | Configurable per-purpose via env vars (easy provider swap) |
| Password hashing | Argon2 | Argon2 (kept, using argon2-cffi) |
| Rate limiting | N/A | Exponential backoff + jitter |
| Testing | None | pytest + httpx + fixtures |
| File limits | 50MB per file | 25MB per file, 150MB per session |