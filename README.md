# 📚 Caky - AI-Powered Exam Preparation Platform

A web platform that helps university students prepare for exams through hyper-focused, context-aware AI tutoring. Students upload their study materials (past exams, slides, notes), and the AI builds a modular curriculum, acting as a personalized tutor for each specific topic.

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

Caky transforms your chaotic study materials into a **structured, modular curriculum**. Instead of one giant chat, Caky breaks your exam down into specific topics, creating a dedicated study environment for each one.

**Key Features:**
- 📄 **PDF Upload** — Upload slides, old exams, notes (with LaTeX formula support).
- 🧩 **Modular Curriculum** — AI analyzes your materials to create a structured list of topics.
- 🎯 **Topic-Specific Chats** — Each topic gets its own dedicated chat thread with focused context.
- ✅ **Knowledge Check** — "Test out" of topics you already know during the planning phase.
- 📊 **Progress Tracking** — Visual dashboard with topic cards, progress bars, and completion status.
- 🔄 **General Review** — A special "Review & Practice" chat that integrates knowledge from all topics.
- 📱 **Responsive Design** — Full mobile support with intuitive sidebar navigation.
- 🤖 **Context-Aware AI** — Gemini 2.5 Flash uses your specific documents to answer questions.
- 🇧🇷 **Brazilian Portuguese** — Fully localized interface and conversational AI.

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
5. Go to **SQL Editor** and run the migrations found in `backend/migrations/`:
   - `001_create_profiles_table.sql`
   - `002_create_study_sessions_table.sql`
   - `003_create_documents_table.sql`
   - `004_create_topics_table.sql`
   - `005_create_chats_table.sql`
   - `006_create_messages_table.sql`

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

1. Open `http://localhost:5173` in your browser.
2. Click "Começar" to create an account.
3. Create a new session (e.g., "Physics Final").
4. Upload PDF documents.
5. Click "Gerar Plano de Estudo" to create the curriculum.
6. Review topics, mark any you already know, and click "Começar a Estudar".
7. Explore the topic cards and start a chat!

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                      │
│                                                                       │
│  Landing  →  Dashboard  →  Session Flow:                              │
│  1. Upload  →  2. Planning (Draft)  →  3. Studying (Topic Cards)      │
│                                                                       │
│  • Apollo Client for GraphQL                                          │
│  • JWT stored in localStorage                                         │
│  • Sidebar for Chat & Document Navigation                             │
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
│  └── GraphQL Resolvers (session, topic, chat, message)               │
│  └── REST Endpoint: POST /api/upload                                 │
├─────────────────────────────────────────────────────────────────────┤
│  SERVICE LAYER (Business Logic)                                      │
│  ├── planning/    → Curriculum generation & refinement               │
│  ├── documents/   → PDF processing & Vision AI extraction            │
│  └── messages/    → Topic-scoped context assembly                    │
├─────────────────────────────────────────────────────────────────────┤
│  STORAGE LAYER (Data Access)                                         │
│  └── SQLx queries with explicit profile_id authorization             │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
      ┌───────────────┐    ┌───────────────┐    ┌────────────────┐
      │  PostgreSQL   │    │   Supabase    │    │   OpenRouter   │
      │  (Supabase)   │    │   Storage     │    │  (Gemini 2.5)  │
      │               │    │   (PDFs)      │    │                │
      │  • profiles   │    │               │    │  • Vision API  │
      │  • topics     │    │  Bucket:      │    │  • Chat API    │
      │  • chats      │    │  "documents"  │    │                │
      │  • messages   │    │               │    │                │
      └───────────────┘    └───────────────┘    └────────────────┘
```

---

## 📁 Project Structure

```
projeto-estudos/
│
├── frontend/                      # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── SessionHeader.tsx
│   │   │   └── ProcessingStatusBadge.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # List of sessions
│   │   │   ├── Session.tsx        # Main router & Study View (Topic Cards)
│   │   │   ├── SessionUpload.tsx  # Step 1: Upload & Processing
│   │   │   └── SessionPlanning.tsx # Step 2: Curriculum Review
│   │   ├── lib/graphql/           # Queries & Mutations
│   │   └── types/                 # TypeScript interfaces
│
├── backend/                       # Rust API Server
│   ├── src/
│   │   ├── api/                   # REST endpoints
│   │   ├── graphql/               # GraphQL Schema & Resolvers
│   │   │   ├── resolvers/
│   │   │   │   ├── topic.rs       # Topic management
│   │   │   │   ├── chat.rs        # Chat creation & retrieval
│   │   │   │   └── planning.rs    # Plan generation logic
│   │   ├── services/              # Business Logic
│   │   │   ├── planning/          # AI Curriculum generation
│   │   │   └── messages/          # Context management
│   │   └── storage/               # DB Access (SQLx)
│   │       ├── topics/
│   │       ├── chats/
│   │       └── profiles/
│   ├── migrations/                # SQL Migration files
```

---

## 🗄️ Database Schema

The database is designed around the **Modular Curriculum** concept.

### 1. Enums
- **SessionStatus**: `PLANNING`, `ACTIVE`, `COMPLETED`
- **ChatType**: `TOPIC_SPECIFIC`, `GENERAL_REVIEW`
- **ProcessingStatus**: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`

### 2. Tables

**`profiles`** (formerly users)
- `id` (UUID, PK)
- `email`, `password_hash`

**`study_sessions`**
- `id` (UUID, PK)
- `profile_id` (FK)
- `status` (Enum: `PLANNING` -> `ACTIVE`)
- `draft_plan` (JSONB): Stores the generated curriculum *before* confirmation.

**`documents`**
- `id` (UUID, PK)
- `session_id` (FK)
- `processing_status` (Enum)
- `content_text` (Text): Extracted text from PDF.

**`topics`**
- `id` (UUID, PK)
- `session_id` (FK)
- `title`, `description`
- `order_index` (Int): Defines the curriculum sequence.
- `is_completed` (Boolean): Tracks mastery of the topic.

**`chats`**
- `id` (UUID, PK)
- `session_id` (FK)
- `type` (Enum: `TOPIC_SPECIFIC` or `GENERAL_REVIEW`)
- `topic_id` (FK, Unique, Nullable): Links chat to a specific topic.
- `is_started` (Boolean)

**`messages`**
- `id` (UUID, PK)
- `chat_id` (FK)
- `role` ('user', 'assistant')
- `content` (Text)

---

## 🔄 Key Workflows

### 1. The Planning Phase (Curriculum Design)
1. **Upload**: User uploads PDFs. System extracts text using Vision AI.
2. **Generate**: User clicks "Gerar Plano". AI analyzes content and creates a `draft_plan` (JSON).
3. **Refine**: User sees the proposed topics.
   - Can mark topics as "Já domino" (Already know).
   - Can ask AI to revise the plan (e.g., "Split Calculus into 2 topics").
4. **Confirm**: User clicks "Começar a Estudar".
   - System creates `topics` rows in the DB.
   - System creates `chats` for each topic + one review chat.
   - Session status moves to `ACTIVE`.

### 2. The Study Phase (Modular Learning)
1. **Dashboard**: User sees a grid of **Topic Cards**.
   - Cards show status: "Não iniciado", "Em progresso", "Concluído".
2. **Topic Chat**: User clicks a card to enter a focused chat.
   - **Context**: AI knows it's teaching *that specific topic*.
   - **Resources**: AI searches documents for relevant sections/questions.
   - **Sidebar**: User can navigate to other topics or the "General Review" chat instantly.
3. **Completion**: User (or AI) marks the topic as "Concluído" via a checkbox.
4. **General Review**: After finishing topics, user enters the "Revisão Geral" chat to practice everything combined.

---

## 📝 Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=your-random-secret
OPENROUTER_API_KEY=sk-or-v1-...
RUST_LOG=info
```

### Frontend (`frontend/.env`)

```env
VITE_GRAPHQL_ENDPOINT=http://localhost:8080/graphql
```

---

## 📌 Design Decisions

### 1. Modular Curriculum over "One Giant Chat"
We moved away from a single long chat history.
**Why:**
- **Focus**: Prevents context pollution. When studying "Derivatives", the AI shouldn't get confused by previous "Limits" questions unless relevant.
- **Progress**: Gives users a clear sense of accomplishment (ticking off boxes).
- **Navigation**: Easier to jump back to a specific subject to review.

### 2. Vision Extraction
We use Gemini 2.5 Flash Vision to "read" PDFs instead of standard text extractors.
**Why:**
- Captures **LaTeX formulas** perfectly ($\int e^x dx$).
- Understands diagrams and slide layouts.

### 3. Draft Plan (JSONB)
We store the plan as a JSON blob (`draft_plan`) in the session table during the planning phase, rather than creating rows immediately.
**Why:**
- Allows cheap, fast iterations/revisions with the AI.
- We only "crystallize" the plan into real `topics` and `chats` rows when the user commits to it.

---

## 📄 License

MIT License - feel free to use this for your own projects!

*Built with ❤️ for students who want to study smarter, not harder.*
