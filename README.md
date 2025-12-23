# 📚 StudyMate - AI-Powered Exam Preparation Platform

A web platform that helps university students prepare for exams through hyper-focused, context-aware AI tutoring. Students upload their study materials (past exams, slides, notes), and the AI becomes a personalized tutor that understands their specific course content.

---

## 🎯 Core Value Proposition

StudyMate provides **contextual tutoring** based on the student's actual course materials. Upload your professor's slides, past exams, and notes — the AI will answer questions, explain concepts, and help you study using exactly what you need to know.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Supabase Auth│  │ Apollo Client│  │   Tailwind + Shadcn/UI   │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ GraphQL + JWT
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Rust + Axum)                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              PRESENTATION LAYER (GraphQL Resolvers)             │ │
│  │         - Schema definition   - Auth context extraction        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  SERVICE LAYER (Business Logic)                 │ │
│  │  - Document Ingestion (download → parse → store)               │ │
│  │  - Chat Orchestration (context assembly → AI call → response)  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                  │                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   STORAGE LAYER (Data Access)                   │ │
│  │         - SQLx with raw SQL   - No ORM abstractions            │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
            ┌───────────┐ ┌───────────┐ ┌───────────────┐
            │ Supabase  │ │ Supabase  │ │   OpenRouter  │
            │ Postgres  │ │  Storage  │ │   (AI API)    │
            └───────────┘ └───────────┘ └───────────────┘
```

---

## 📁 Project Structure

```
projeto-estudos/
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/          # UI components
│   │   │   ├── ui/              # Shadcn/UI components
│   │   │   ├── auth/            # Login, signup forms
│   │   │   ├── chat/            # Chat interface components
│   │   │   ├── documents/       # Document upload & management
│   │   │   └── sessions/        # Study session components
│   │   ├── pages/               # Route pages
│   │   │   ├── Landing.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Session.tsx      # Main study session view
│   │   │   └── Auth.tsx
│   │   ├── lib/                 # Utilities & API setup
│   │   │   ├── supabase.ts      # Supabase client
│   │   │   ├── apollo.ts        # Apollo client setup
│   │   │   ├── graphql/         # GraphQL operations
│   │   │   │   ├── queries.ts
│   │   │   │   ├── mutations.ts
│   │   │   │   └── fragments.ts
│   │   │   └── utils.ts
│   │   ├── hooks/               # Custom React hooks
│   │   ├── types/               # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                     # Rust application
│   ├── src/
│   │   ├── main.rs              # Entry point, server setup
│   │   ├── config.rs            # Environment configuration
│   │   ├── graphql/             # Presentation Layer
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs        # GraphQL schema definition
│   │   │   ├── context.rs       # Request context (auth)
│   │   │   ├── resolvers/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── session.rs   # Study session resolvers
│   │   │   │   ├── document.rs  # Document resolvers
│   │   │   │   └── message.rs   # Chat message resolvers
│   │   │   └── types/           # GraphQL type definitions
│   │   │       ├── mod.rs
│   │   │       ├── session.rs
│   │   │       ├── document.rs
│   │   │       └── message.rs
│   │   ├── services/            # Service Layer (by domain)
│   │   │   ├── mod.rs
│   │   │   ├── auth/            # Authentication
│   │   │   │   ├── mod.rs
│   │   │   │   └── jwt.rs       # JWT validation
│   │   │   ├── sessions/        # Session business logic
│   │   │   │   └── mod.rs
│   │   │   ├── documents/       # Document processing
│   │   │   │   ├── mod.rs
│   │   │   │   ├── ingestion.rs # Download & parse PDFs
│   │   │   │   └── storage_client.rs # Supabase Storage client
│   │   │   └── messages/        # Chat orchestration
│   │   │       ├── mod.rs
│   │   │       └── ai_client.rs # OpenRouter API client
│   │   ├── storage/             # Storage Layer (by domain)
│   │   │   ├── mod.rs
│   │   │   ├── sessions/        # Session queries
│   │   │   │   └── mod.rs
│   │   │   ├── documents/       # Document queries
│   │   │   │   └── mod.rs
│   │   │   └── messages/        # Message queries
│   │   │       └── mod.rs
│   │   └── errors.rs            # Error types
│   ├── migrations/              # SQL migration files
│   │   └── 001_initial_schema.sql
│   ├── Cargo.toml
│   └── .env.example
│
├── supabase/                    # Supabase configuration
│   └── migrations/              # Database migrations
│       └── 001_initial_schema.sql
│
├── .env.example                 # Environment variables template
├── .gitignore
└── README.md
```

---

## 🗄️ Database Schema

```sql
-- Users are managed by Supabase Auth (auth.users)

-- Study Sessions
CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents (extracted text from uploaded files)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,           -- Path in Supabase Storage
    content_text TEXT NOT NULL,         -- Extracted plain text
    content_length INTEGER NOT NULL,    -- Character count for context management
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

-- Indexes for performance
CREATE INDEX idx_sessions_user ON study_sessions(user_id);
CREATE INDEX idx_documents_session ON documents(session_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(session_id, created_at);

-- Row Level Security (RLS)
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users own their sessions" ON study_sessions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access documents in their sessions" ON documents
    FOR ALL USING (
        session_id IN (SELECT id FROM study_sessions WHERE user_id = auth.uid())
    );

CREATE POLICY "Users access messages in their sessions" ON messages
    FOR ALL USING (
        session_id IN (SELECT id FROM study_sessions WHERE user_id = auth.uid())
    );
```

---

## 🔄 Key Workflows

### 1. Authentication Flow
```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│ Frontend │────▶│ Supabase Auth│────▶│   Backend   │
│  Login   │     │  (Get JWT)   │     │ (Validate)  │
└──────────┘     └──────────────┘     └─────────────┘
     │                                       │
     │         JWT in Authorization          │
     └───────────────────────────────────────┘
```

### 2. Document Ingestion Flow
```
1. User uploads PDF → Supabase Storage
2. Frontend calls: addDocument(sessionId, filePath, fileName)
3. Backend:
   a. Downloads file from Supabase Storage
   b. Extracts text using PDF parser
   c. Saves to database: INSERT INTO documents (content_text, ...)
4. Returns success → Frontend updates UI
```

### 3. Chat Flow
```
1. User sends message via: sendMessage(sessionId, content)
2. Backend Service Layer:
   a. Fetch recent chat history (last N messages)
   b. Fetch all document texts for session
   c. Assemble prompt:
      ┌─────────────────────────────────────────────────┐
      │ SYSTEM: You are a tutor. Use this context:      │
      │ [DOCUMENT 1 TEXT]                               │
      │ [DOCUMENT 2 TEXT]                               │
      │ ...                                             │
      ├─────────────────────────────────────────────────┤
      │ USER: [previous message]                        │
      │ ASSISTANT: [previous response]                  │
      │ USER: [current message]                         │
      └─────────────────────────────────────────────────┘
   d. Call OpenRouter API (gemini-flash-1.5 or gpt-4o-mini)
   e. Save user message + AI response to database
3. Return AI response → Frontend displays
```

---

## 🚀 Implementation Roadmap

### Phase 1: Foundation Setup
- [ ] **1.1** Initialize Rust backend with Cargo
- [ ] **1.2** Initialize React frontend with Vite + TypeScript
- [ ] **1.3** Set up Supabase project (database + storage + auth)
- [ ] **1.4** Configure environment variables
- [ ] **1.5** Run initial database migrations

### Phase 2: Backend Core
- [ ] **2.1** Set up Axum server with health check endpoint
- [ ] **2.2** Implement GraphQL schema with async-graphql
- [ ] **2.3** Create Storage Layer (SQLx connection pool + queries)
- [ ] **2.4** Implement JWT middleware for authentication
- [ ] **2.5** Build session CRUD resolvers

### Phase 3: Document Ingestion
- [ ] **3.1** Implement Supabase Storage client (download files)
- [ ] **3.2** Integrate PDF text extraction (lopdf or pdf-extract)
- [ ] **3.3** Build ingestion service (download → parse → store)
- [ ] **3.4** Create document GraphQL resolvers

### Phase 4: AI Chat Integration
- [ ] **4.1** Set up OpenRouter client with async-openai
- [ ] **4.2** Implement context assembly service
- [ ] **4.3** Build chat service (prompt construction → API call)
- [ ] **4.4** Create message GraphQL resolvers
- [ ] **4.5** Handle chat history retrieval

### Phase 5: Frontend Foundation
- [ ] **5.1** Set up Tailwind CSS + Shadcn/UI
- [ ] **5.2** Configure Apollo Client for GraphQL
- [ ] **5.3** Integrate Supabase Auth (login/signup)
- [ ] **5.4** Create protected routes

### Phase 6: Frontend Features
- [ ] **6.1** Build Dashboard page (list sessions)
- [ ] **6.2** Create/edit study sessions
- [ ] **6.3** Document upload interface
- [ ] **6.4** Chat interface with message history
- [ ] **6.5** Landing page

### Phase 7: Polish & Testing
- [ ] **7.1** Error handling & loading states
- [ ] **7.2** Responsive design
- [ ] **7.3** Basic rate limiting
- [ ] **7.4** End-to-end testing

---

## 🛠️ Tech Stack Details

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + Vite | Fast development, modern tooling |
| | TypeScript | Type safety |
| | Tailwind CSS | Utility-first styling |
| | Shadcn/UI | Beautiful, accessible components |
| | Apollo Client | GraphQL state management |
| **Backend** | Rust | Performance, safety |
| | Axum | Async web framework |
| | async-graphql | GraphQL server |
| | SQLx | Type-safe SQL queries |
| | lopdf | PDF parsing |
| **Infrastructure** | Supabase | Auth, database, storage |
| | OpenRouter | AI model access |

---

## 📝 Environment Variables

```env
# Backend
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
OPENROUTER_API_KEY=sk-or-...
RUST_LOG=info

# Frontend
VITE_SUPABASE_URL=https://[PROJECT].supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GRAPHQL_ENDPOINT=http://localhost:8080/graphql
```

---

## 🏃 Quick Start (After Setup)

```bash
# Terminal 1: Backend
cd backend
cargo run

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

---

## 📌 Design Decisions

1. **Full-text context over RAG**: For V1, we pass complete document text to LLMs with large context windows (Gemini Flash 1.5 = 1M tokens). This avoids embedding/vector DB complexity while being sufficient for typical study materials.

2. **Raw SQL over ORM**: Using SQLx with explicit SQL queries gives us complete control, better performance, and easier debugging. The queries are simple enough that an ORM adds no value.

3. **Supabase as backend-for-frontend**: Leverages managed auth and storage, but our Rust backend handles all business logic and AI orchestration.

4. **GraphQL for API**: Provides flexible querying for the frontend and strong typing with code generation.

---

## 🔮 Future Considerations (V2+)

- **Streaming responses**: SSE for real-time AI response streaming
- **Smart context selection**: When documents exceed context limits, use relevance scoring
- **Flashcard generation**: AI-generated flashcards from uploaded materials
- **Quiz mode**: Practice questions based on document content
- **Collaboration**: Share sessions with study groups
- **Mobile app**: React Native companion app

---

*Built with ❤️ for students who want to study smarter, not harder.*

