# 📚 StudyMate - AI-Powered Exam Preparation Platform

A web platform that helps university students prepare for exams through hyper-focused, context-aware AI tutoring. Students upload their study materials (past exams, slides, notes), and the AI becomes a personalized tutor that understands their specific course content.

---

## Table of Contents

1. [Core Value Proposition](#-core-value-proposition)
2. [Getting Started](#-getting-started)
3. [Architecture Overview](#-architecture-overview)
4. [Project Structure](#-project-structure)
5. [Database Schema](#-database-schema)
6. [API Reference](#-api-reference)
7. [Key Workflows](#-key-workflows)
8. [Tech Stack](#-tech-stack)
9. [Environment Variables](#-environment-variables)
10. [Design Decisions](#-design-decisions)
11. [Troubleshooting](#-troubleshooting)
12. [Future Roadmap](#-future-roadmap)

---

## 🎯 Core Value Proposition

StudyMate provides **contextual tutoring** based on the student's actual course materials. Upload your professor's slides, past exams, and notes — the AI will answer questions, explain concepts, and help you study using exactly what you need to know.

**Key Features:**
- 📄 **PDF Upload** — Upload slides, old exams, notes (with formula support)
- 🧠 **Context-Aware AI** — Gemini 2.5 Flash uses your materials to answer questions
- 💬 **Chat History** — Conversations are saved per study session
- 📱 **Responsive Design** — Works on desktop and mobile

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

```bash
# Rust (latest stable)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update stable

# Node.js (v18+)
# Use nvm or download from https://nodejs.org

# Poppler (for PDF to image conversion)
# macOS:
brew install poppler

# Ubuntu/Debian:
sudo apt install poppler-utils

# Verify Poppler:
pdftoppm -v  # Should show version info
```

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd projeto-estudos
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database** and copy the connection string (use "Session pooler" mode)
3. Go to **Settings → API** and copy:
   - Project URL (e.g., `https://xxx.supabase.co`)
   - `service_role` key (secret, for backend only)
4. Go to **Storage** and create a bucket called `documents` (set to **Private**)
5. Go to **SQL Editor** and run the migration:

```sql
-- Copy contents of backend/migrations/001_initial_schema.sql and run it
```

### 3. Backend Setup

```bash
cd backend

# Create .env file (copy from example)
cp .env.example .env

# Edit .env with your values:
# DATABASE_URL=postgresql://...
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_SERVICE_KEY=eyJ...
# JWT_SECRET=<generate-a-random-32-char-string>
# OPENROUTER_API_KEY=sk-or-...
# RUST_LOG=info

# Run the backend
cargo run
```

The backend will start at `http://localhost:8080`. Test it:
```bash
curl http://localhost:8080/health  # Should return "OK"
```

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_GRAPHQL_ENDPOINT=http://localhost:8080/graphql" > .env

# Run the frontend
npm run dev
```

The frontend will start at `http://localhost:5173`.

### 5. Verify Everything Works

1. Open `http://localhost:5173` in your browser
2. Click "Get Started" to create an account
3. Create a study session
4. Upload a PDF document
5. Chat with the AI about your document content

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                      │
│                                                                       │
│  Landing Page  →  Auth Forms  →  Dashboard  →  Session (Chat + Docs) │
│                                                                       │
│  • Apollo Client for GraphQL                                          │
│  • JWT stored in localStorage                                         │
│  • Zero API keys (all external calls go through backend)             │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │ GraphQL (POST /graphql)             │
                 │ File Upload (POST /api/upload)      │
                 │ Auth: Bearer <JWT>                  │
                 └──────────────────┬──────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Rust + Axum)                        │
├─────────────────────────────────────────────────────────────────────┤
│  PRESENTATION LAYER                                                  │
│  └── GraphQL Resolvers (queries, mutations)                          │
│  └── REST Endpoint: POST /api/upload (multipart file upload)         │
├─────────────────────────────────────────────────────────────────────┤
│  SERVICE LAYER (Business Logic)                                      │
│  ├── auth/        → Password hashing (Argon2), JWT creation          │
│  ├── documents/   → PDF download, image conversion, vision AI        │
│  └── messages/    → Context assembly, OpenRouter API calls           │
├─────────────────────────────────────────────────────────────────────┤
│  STORAGE LAYER (Data Access)                                         │
│  └── SQLx queries with explicit user_id authorization                │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      ┌───────────────┐    ┌───────────────┐    ┌────────────────┐
      │  PostgreSQL   │    │   Supabase    │    │   OpenRouter   │
      │  (Supabase)   │    │   Storage     │    │  (Gemini 2.5)  │
      │               │    │   (PDFs)      │    │                │
      │  • users      │    │               │    │  • Vision API  │
      │  • sessions   │    │  Bucket:      │    │  • Chat API    │
      │  • documents  │    │  "documents"  │    │                │
      │  • messages   │    │  (private)    │    │                │
      └───────────────┘    └───────────────┘    └────────────────┘
```

### Data Flow Example: User Sends a Chat Message

```
1. User types "Explain Theorem 3.2" and clicks Send
2. Frontend calls GraphQL: sendMessage(sessionId, "Explain Theorem 3.2")
3. Backend:
   a. Validates JWT token
   b. Fetches all documents for this session (with user_id check)
   c. Fetches last 20 chat messages
   d. Builds prompt: [System + Document Texts + Chat History + User Message]
   e. Calls OpenRouter API (Gemini 2.5 Flash)
   f. Saves user message + AI response to database
   g. Returns AI response
4. Frontend displays the AI response in the chat
```

---

## 📁 Project Structure

```
projeto-estudos/
│
├── frontend/                      # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   └── AuthForm.tsx   # Login/Signup form
│   │   │   └── ProtectedRoute.tsx # Route guard for auth
│   │   │
│   │   ├── pages/
│   │   │   ├── Landing.tsx        # Homepage with hero section
│   │   │   ├── Auth.tsx           # Auth page wrapper
│   │   │   ├── Dashboard.tsx      # List of study sessions
│   │   │   └── Session.tsx        # Main study view (docs + chat)
│   │   │
│   │   ├── lib/
│   │   │   ├── apollo.ts          # Apollo Client configuration
│   │   │   ├── auth.tsx           # AuthContext + useAuth hook
│   │   │   ├── utils.ts           # cn() helper for Tailwind
│   │   │   └── graphql/
│   │   │       ├── queries.ts     # GraphQL query definitions
│   │   │       └── mutations.ts   # GraphQL mutation definitions
│   │   │
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript interfaces
│   │   │
│   │   ├── App.tsx                # Router configuration
│   │   ├── main.tsx               # Entry point (providers)
│   │   └── index.css              # Tailwind + custom styles
│   │
│   ├── .env                       # VITE_GRAPHQL_ENDPOINT only
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                       # Rust API Server
│   ├── src/
│   │   ├── main.rs                # Axum server setup, routes
│   │   ├── config.rs              # Environment variable loading
│   │   ├── errors.rs              # Custom error types
│   │   │
│   │   ├── api/
│   │   │   ├── mod.rs
│   │   │   └── upload.rs          # POST /api/upload handler
│   │   │
│   │   ├── graphql/
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs          # Schema + AppState + handlers
│   │   │   ├── context.rs         # GraphQLContext (user_id from JWT)
│   │   │   ├── resolvers/
│   │   │   │   ├── auth.rs        # register, login, me
│   │   │   │   ├── session.rs     # CRUD for study sessions
│   │   │   │   ├── document.rs    # addDocument, deleteDocument
│   │   │   │   └── message.rs     # messages, sendMessage, clearMessages
│   │   │   └── types/
│   │   │       ├── user.rs        # User GraphQL type
│   │   │       ├── session.rs     # Session GraphQL type
│   │   │       ├── document.rs    # Document GraphQL type
│   │   │       └── message.rs     # Message GraphQL type
│   │   │
│   │   ├── services/              # Business Logic Layer
│   │   │   ├── auth/
│   │   │   │   ├── password.rs    # hash_password(), verify_password()
│   │   │   │   └── jwt.rs         # create_jwt(), verify_jwt()
│   │   │   ├── documents/
│   │   │   │   ├── ingestion.rs   # process_pdf(), process_document()
│   │   │   │   └── storage_client.rs  # Supabase Storage API
│   │   │   └── messages/
│   │   │       ├── ai_client.rs   # OpenRouterClient
│   │   │       └── chat.rs        # send_message() orchestration
│   │   │
│   │   └── storage/               # Data Access Layer
│   │       ├── users/mod.rs       # create_user, get_user_by_email
│   │       ├── sessions/mod.rs    # CRUD for study_sessions
│   │       ├── documents/mod.rs   # CRUD for documents
│   │       └── messages/mod.rs    # CRUD for messages
│   │
│   ├── migrations/
│   │   └── 001_initial_schema.sql # Database schema
│   │
│   ├── .env                       # All secrets (gitignored)
│   └── Cargo.toml                 # Rust dependencies
│
├── .gitignore                     # Ignores .env files
└── README.md                      # This file
```

---

## 🗄️ Database Schema

> **Portability Note:** This schema uses standard PostgreSQL only. No Supabase-specific features.
> Authorization is enforced in the Rust service layer, not via RLS.

```sql
-- Users (email + password authentication)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,  -- Argon2 hash
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Study Sessions (one user has many sessions)
CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents (extracted text from uploaded PDFs)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,               -- Path in Supabase Storage
    content_text TEXT NOT NULL,            -- Extracted text (with LaTeX)
    content_length INTEGER NOT NULL,       -- Character count
    extraction_status VARCHAR(20) DEFAULT 'pending'
        CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
    page_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_user ON study_sessions(user_id);
CREATE INDEX idx_documents_session ON documents(session_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(session_id, created_at);
```

### Entity Relationships

```
┌─────────┐       ┌─────────────────┐       ┌───────────┐
│  users  │──1:N──│ study_sessions  │──1:N──│ documents │
└─────────┘       └─────────────────┘       └───────────┘
                          │
                          │ 1:N
                          ▼
                   ┌───────────┐
                   │ messages  │
                   └───────────┘
```

### Authorization Pattern

Every database query includes `user_id` validation in the WHERE clause:

```rust
// Getting user's sessions - direct ownership
SELECT * FROM study_sessions WHERE user_id = $1

// Getting documents - ownership through session
SELECT d.* FROM documents d
JOIN study_sessions s ON d.session_id = s.id
WHERE s.user_id = $1 AND d.session_id = $2

// Getting messages - same pattern
SELECT m.* FROM messages m
JOIN study_sessions s ON m.session_id = s.id
WHERE s.user_id = $1 AND m.session_id = $2
```

---

## 📡 API Reference

### GraphQL Endpoint

```
POST /graphql
Content-Type: application/json
Authorization: Bearer <jwt>  (for authenticated operations)
```

GraphQL Playground available at: `GET /graphql`

### Queries

| Query | Auth Required | Description |
|-------|---------------|-------------|
| `me` | ✅ | Get current user info |
| `sessions` | ✅ | List all study sessions |
| `session(id)` | ✅ | Get single session by ID |
| `documents(sessionId)` | ✅ | List documents in a session |
| `messages(sessionId)` | ✅ | Get chat history for a session |

### Mutations

| Mutation | Auth Required | Description |
|----------|---------------|-------------|
| `register(email, password)` | ❌ | Create new account |
| `login(email, password)` | ❌ | Authenticate, get JWT |
| `createSession(title, description?)` | ✅ | Create study session |
| `updateSession(id, title?, description?)` | ✅ | Update session |
| `deleteSession(id)` | ✅ | Delete session + all docs/messages |
| `deleteDocument(id)` | ✅ | Delete a document |
| `sendMessage(sessionId, content)` | ✅ | Send message, get AI response |
| `clearMessages(sessionId)` | ✅ | Clear chat history |

### REST Endpoint

```
POST /api/upload
Content-Type: multipart/form-data
Authorization: Bearer <jwt>

Form fields:
  - file: <PDF file>
  - sessionId: <UUID>

Response:
{
  "id": "uuid",
  "file_name": "lecture.pdf",
  "file_path": "session-id/timestamp-lecture.pdf",
  "extraction_status": "processing",
  "message": "File uploaded successfully. Text extraction in progress."
}
```

### Example GraphQL Operations

```graphql
# Register
mutation {
  register(email: "student@uni.edu", password: "password123") {
    token
    user { id email }
  }
}

# Login
mutation {
  login(email: "student@uni.edu", password: "password123") {
    token
    user { id email }
  }
}

# Create session
mutation {
  createSession(title: "Calculus Final", description: "Chapters 5-8") {
    id title createdAt
  }
}

# Send message (returns AI response)
mutation {
  sendMessage(sessionId: "...", content: "Explain integration by parts") {
    id role content createdAt
  }
}

# Get messages
query {
  messages(sessionId: "...") {
    id role content createdAt
  }
}
```

---

## 🔄 Key Workflows

### 1. Authentication Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                          REGISTRATION                                 │
├──────────────────────────────────────────────────────────────────────┤
│  1. User enters email + password                                      │
│  2. Frontend calls: register(email, password)                         │
│  3. Backend:                                                          │
│     a. Check if email already exists                                  │
│     b. Hash password with Argon2                                      │
│     c. Insert user into database                                      │
│     d. Create JWT token (expires in 7 days)                           │
│  4. Frontend stores token in localStorage                             │
│  5. User redirected to Dashboard                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                            LOGIN                                      │
├──────────────────────────────────────────────────────────────────────┤
│  1. User enters email + password                                      │
│  2. Frontend calls: login(email, password)                            │
│  3. Backend:                                                          │
│     a. Look up user by email                                          │
│     b. Verify password with Argon2                                    │
│     c. Create JWT token                                               │
│  4. Frontend stores token, redirects to Dashboard                     │
└──────────────────────────────────────────────────────────────────────┘

JWT Token Structure:
{
  "sub": "<user-uuid>",        // Subject (user ID)
  "email": "student@uni.edu",
  "exp": 1234567890            // Expiration timestamp
}
```

### 2. Document Upload Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT UPLOAD + PROCESSING                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  FRONTEND                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  1. User selects PDF file                                        │ │
│  │  2. Frontend sends: POST /api/upload (multipart/form-data)       │ │
│  │     - file: <PDF>                                                 │ │
│  │     - sessionId: <UUID>                                           │ │
│  │     - Authorization: Bearer <JWT>                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼                                        │
│  BACKEND                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  3. Validate request:                                             │ │
│  │     ✓ JWT token valid?                                            │ │
│  │     ✓ User owns this session?                                     │ │
│  │     ✓ File is PDF?                                                │ │
│  │     ✓ File size < 50MB?                                           │ │
│  │                                                                   │ │
│  │  4. Upload PDF to Supabase Storage (using service key)            │ │
│  │                                                                   │ │
│  │  5. Create document record (status: 'pending')                    │ │
│  │                                                                   │ │
│  │  6. Return immediately: { id, extraction_status: 'processing' }   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼                                        │
│  BACKGROUND TASK (spawned)                                            │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  7. Download PDF from Supabase Storage                            │ │
│  │                                                                   │ │
│  │  8. Convert to images using pdftoppm (150 DPI)                    │ │
│  │     lecture.pdf → page-01.png, page-02.png, ...                   │ │
│  │                                                                   │ │
│  │  9. For each page image:                                          │ │
│  │     - Encode to base64                                            │ │
│  │     - Send to Gemini 2.5 Flash Vision API                         │ │
│  │     - Receive extracted text with LaTeX formulas                  │ │
│  │                                                                   │ │
│  │  10. Combine all page texts                                       │ │
│  │                                                                   │ │
│  │  11. Update database:                                             │ │
│  │      - content_text = extracted text                              │ │
│  │      - extraction_status = 'completed'                            │ │
│  │      - page_count = number of pages                               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                              │                                        │
│                              ▼                                        │
│  FRONTEND (polling)                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  12. Poll GET_DOCUMENTS every 3 seconds                           │ │
│  │  13. When status = 'completed' → show success toast               │ │
│  │      When status = 'failed' → show error toast                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

Why Vision Extraction?
─────────────────────
Traditional PDF text extraction (like pdftotext) fails with:
  ✗ Mathematical formulas: ∫₀^∞ e^(-x²) dx
  ✗ Chemical equations: H₂O + CO₂ → H₂CO₃
  ✗ Complex diagrams with embedded text

Gemini Vision "reads" the page like a human and outputs:
  ✓ "The integral $$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$"
```

### 3. Chat Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CHAT WITH AI                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. User types: "Explain the proof of Theorem 3.2"                    │
│                                                                       │
│  2. Frontend calls: sendMessage(sessionId, content)                   │
│                                                                       │
│  3. Backend builds context:                                           │
│     ┌─────────────────────────────────────────────────────────────┐  │
│     │ SYSTEM PROMPT:                                               │  │
│     │ You are an expert tutor. Use ONLY the following study       │  │
│     │ materials to answer questions. If the answer is not in      │  │
│     │ the materials, say so.                                       │  │
│     │                                                              │  │
│     │ === STUDY MATERIALS ===                                      │  │
│     │                                                              │  │
│     │ [lecture-01.pdf]                                             │  │
│     │ --- Page 1 ---                                               │  │
│     │ Chapter 3: Advanced Integration...                           │  │
│     │ --- Page 2 ---                                               │  │
│     │ Theorem 3.2: If f(x) is continuous on [a,b], then...        │  │
│     │ ...                                                          │  │
│     │                                                              │  │
│     │ [exam-2023.pdf]                                              │  │
│     │ Question 1: Prove Theorem 3.2...                             │  │
│     │ ...                                                          │  │
│     │                                                              │  │
│     │ === CONVERSATION HISTORY ===                                 │  │
│     │ User: What topics should I focus on?                         │  │
│     │ Assistant: Based on your materials...                        │  │
│     │ User: Explain the proof of Theorem 3.2  ← current message   │  │
│     └─────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  4. Send to OpenRouter API (Gemini 2.5 Flash)                         │
│                                                                       │
│  5. Save both messages to database:                                   │
│     - User message (role: 'user')                                     │
│     - AI response (role: 'assistant')                                 │
│                                                                       │
│  6. Return AI response to frontend                                    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

Context Window Usage:
────────────────────
Gemini 2.5 Flash has a 1 million token context window.
For a typical study session:
  - 10 document pages × 500 tokens/page = 5,000 tokens
  - 20 chat messages × 100 tokens/message = 2,000 tokens
  - System prompt = 200 tokens
  - Total: ~7,200 tokens (0.7% of capacity)

This is why we use full-text context instead of RAG for V1.
```

---

## 🛠️ Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| Vite | 7 | Build tool, dev server |
| TypeScript | 5.9 | Type safety |
| Tailwind CSS | 4 | Styling (new v4 syntax) |
| Apollo Client | 4 | GraphQL client |
| React Router | 7 | Client-side routing |
| Sonner | 2 | Toast notifications |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Rust | stable | Systems language |
| Axum | 0.8 | Web framework |
| async-graphql | 7 | GraphQL server |
| SQLx | 0.8 | Database queries (compile-time checked) |
| argon2 | 0.5 | Password hashing |
| jsonwebtoken | 9 | JWT handling |
| reqwest | 0.12 | HTTP client (for APIs) |
| tokio | 1 | Async runtime |
| Poppler (pdftoppm) | system | PDF to image conversion |

### Infrastructure

| Service | Purpose |
|---------|---------|
| Supabase PostgreSQL | Database |
| Supabase Storage | PDF file storage |
| OpenRouter | AI API gateway |
| Gemini 2.5 Flash | Vision + Chat AI model |

---

## 📝 Environment Variables

### Backend (`backend/.env`)

```env
# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Supabase Storage
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # Service role key (has full access)

# Authentication
JWT_SECRET=your-random-secret-at-least-32-characters-long

# AI API
OPENROUTER_API_KEY=sk-or-v1-...

# Logging
RUST_LOG=info  # Options: trace, debug, info, warn, error
```

### Frontend (`frontend/.env`)

```env
# Backend API
VITE_GRAPHQL_ENDPOINT=http://localhost:8080/graphql
```

> **Security Note:** The frontend has ZERO API keys. All external API calls
> (Supabase Storage, OpenRouter) go through the backend.

### Generating a JWT Secret

```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 📌 Design Decisions

### 1. Full-Text Context over RAG

For V1, we pass complete document text to the LLM instead of using embeddings/vector search.

**Why:**
- Gemini 2.5 Flash has a 1M token context window
- Typical study session: ~10 documents × ~500 tokens = 5,000 tokens (0.5% of capacity)
- Avoids complexity of embeddings, vector DB, and relevance tuning
- Perfect recall (the AI sees everything, not a selection)

**When to switch to RAG:**
- Documents exceed ~500K tokens total
- Need faster response times (smaller context = faster)
- Need to cite specific sources in responses

### 2. Raw SQL over ORM

We use SQLx with explicit SQL queries instead of an ORM like Diesel or SeaORM.

**Why:**
- Queries are simple (no complex joins or aggregations)
- Full control over query optimization
- Compile-time query checking with `sqlx::query!`
- Easier to debug (can copy queries directly to SQL console)

### 3. Custom Auth over Supabase Auth

We implement our own email/password auth instead of using Supabase Auth.

**Why:**
- Full control over user management
- Works with any PostgreSQL (AWS RDS, Railway, Neon, self-hosted)
- Easier to add features (email verification, OAuth) later
- No dependency on Supabase-specific `auth.uid()` function

### 4. Backend-Proxied Uploads over Direct Upload

Files go Frontend → Backend → Supabase Storage, not Frontend → Supabase directly.

**Why:**
- Zero API keys in frontend (more secure)
- Server-side validation (file type, size, ownership)
- Can modify files before storage (e.g., virus scan, resize)
- Single source of truth for authorization

### 5. GraphQL over REST

We use GraphQL for the API layer.

**Why:**
- Flexible queries (frontend gets exactly what it needs)
- Strong typing with code generation
- Single endpoint simplifies infrastructure
- Subscriptions ready for real-time features (V2)

---

## 🔧 Troubleshooting

### Backend won't start

**"Failed to connect to database"**
```bash
# Check DATABASE_URL format:
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Make sure you're using the "Session pooler" connection string
# (not "Transaction pooler" or "Direct connection")
```

**"pdftoppm not found"**
```bash
# Install Poppler:
brew install poppler    # macOS
sudo apt install poppler-utils  # Ubuntu
```

### Frontend issues

**"Cannot read properties of null (reading 'useContext')"**
- Make sure `AuthProvider` wraps your app in `main.tsx`
- Check that you're using `@apollo/client/react` for hooks

**"CORS error"**
- Backend CORS is configured for `http://localhost:5173`
- If using a different port, update `src/main.rs`

### Upload issues

**"Failed to upload file to storage"**
- Check that the `documents` bucket exists in Supabase Storage
- Verify `SUPABASE_SERVICE_KEY` is the service role key (not anon key)

**"extraction_status stuck on 'processing'"**
- Check backend logs for vision API errors
- Verify `OPENROUTER_API_KEY` is valid
- Make sure `pdftoppm` is installed

### AI chat issues

**"AI response is empty or generic"**
- Check that documents have `extraction_status: 'completed'`
- Verify document `content_text` is not empty
- Check OpenRouter API key and credits

---

## 🔮 Future Roadmap (V2+)

| Feature | Description |
|---------|-------------|
| **Streaming Responses** | Real-time AI response streaming via SSE |
| **Smart Context Selection** | When documents exceed limits, use relevance scoring |
| **Flashcard Generation** | AI-generated flashcards from materials |
| **Quiz Mode** | Practice questions based on content |
| **Collaboration** | Share sessions with study groups |
| **Mobile App** | React Native companion app |
| **Email Verification** | Verify email on signup |
| **OAuth** | Login with Google, GitHub |
| **Export** | Export chat history as PDF |

---

## 📄 License

MIT License - feel free to use this for your own projects!

---

*Built with ❤️ for students who want to study smarter, not harder.*
