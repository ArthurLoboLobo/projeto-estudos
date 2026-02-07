# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Caky** — AI-powered exam preparation platform. Students upload PDFs, AI extracts content via vision models, generates a modular study curriculum, and provides topic-specific tutoring chats with progress tracking.

**Stack:** React 19 + TypeScript + Vite (frontend) | Rust + Axum + async-graphql + SQLx (backend) | PostgreSQL on Supabase | OpenRouter API (Gemini 2.5 Flash)

## Common Commands

### Frontend (`cd frontend`)
```bash
npm install          # install dependencies
npm run dev          # dev server on :5173
npm run build        # production build
npm run lint         # ESLint check
```

### Backend (`cd backend`)
```bash
cargo run            # server on :8080
cargo build          # compile
cargo clippy         # lint
```

### Prerequisites
- Rust stable, Node.js 18+, `poppler` (for `pdftoppm` — `brew install poppler` on macOS)

## Architecture

```
Frontend (React/Apollo) → GraphQL API (Axum) → Services → Storage (SQLx) → PostgreSQL
                        → REST /api/upload (PDFs)                        → Supabase Storage
                                                                         → OpenRouter AI
```

### Backend Layers (backend/src/)

| Layer | Path | Purpose |
|-------|------|---------|
| API | `api/upload.rs` | REST multipart file upload endpoint |
| GraphQL | `graphql/schema.rs` | Schema setup, context extraction (JWT → user_id + language) |
| GraphQL | `graphql/resolvers/` | One file per domain: auth, session, document, topic, chat, message, planning |
| GraphQL | `graphql/types/` | GraphQL object types mirroring DB tables |
| Services | `services/auth/` | JWT (jsonwebtoken) + Argon2 password hashing |
| Services | `services/documents/` | PDF→image→vision extraction, Supabase storage client |
| Services | `services/planning/` | Study plan generation and revision via AI |
| Services | `services/messages/` | OpenRouter chat client, context assembly for topic/review chats |
| Storage | `storage/<entity>/` | All SQLx queries — every query filters by `profile_id` for authorization |
| Prompts | `prompts.rs` | All AI system prompt templates with `{topic_name}`, `{language}`, `{context}` placeholders |

### Frontend Organization (frontend/src/)

| Path | Purpose |
|------|---------|
| `pages/` | Route-level components: Landing, Auth, Dashboard, Session (routes to Upload/Planning/Studying based on status) |
| `lib/graphql/queries.ts` | All GraphQL query strings |
| `lib/graphql/mutations.ts` | All GraphQL mutation strings |
| `lib/auth.tsx` | Auth context + useAuth hook, JWT in localStorage (`caky_token`) |
| `lib/apollo.ts` | Apollo Client setup with auth header injection |
| `types/index.ts` | Shared TypeScript interfaces |
| `i18n/locales/pt.json`, `en.json` | Translation files (react-i18next) |
| `components/ui/Markdown.tsx` | Markdown renderer with KaTeX/LaTeX support |

## Key Architectural Patterns

### Draft Plan Pattern
Plan generation stores JSON in `study_sessions.draft_plan` (JSONB column). Users can iterate cheaply via `revisePlan` mutation. Only `startStudying` crystallizes the plan into actual `topics` + `chats` rows. This prevents DB pollution during planning.

### Session Status Flow
`PLANNING` (upload docs → generate/refine plan) → `ACTIVE` (startStudying creates topics/chats) → `COMPLETED`

### PDF Processing Pipeline
Upload → Supabase Storage → `pdftoppm` converts to images → Gemini Vision extracts text (parallel per page) → stored in `documents.content_text` → frontend polls status every 5s

### Auth & Authorization
- JWT in `Authorization: Bearer <token>` header on all requests
- Language in `x-language: pt|en` header
- Context extracted in `graphql/schema.rs::extract_context()`
- **Critical:** Every storage query must include `profile_id` filter to prevent cross-user data access

### i18n
- Frontend: `react-i18next`, default Portuguese, stored in localStorage (`language` key)
- Backend: receives language via header, converts to full name (pt→Portuguese) for AI prompts so responses match user language

## Database

Six tables: `profiles`, `study_sessions`, `documents`, `topics`, `chats`, `messages`. Migrations in `backend/migrations/` (numbered SQL files, run manually via Supabase dashboard).

Key enums: `SessionStatus` (PLANNING/ACTIVE/COMPLETED), `ChatType` (TOPIC_SPECIFIC/GENERAL_REVIEW), `ProcessingStatus` (PENDING/PROCESSING/COMPLETED/FAILED)

## Adding a New Feature (typical flow)

1. DB migration if schema changes → `backend/migrations/`
2. Storage query → `backend/src/storage/<entity>/mod.rs`
3. Service logic if needed → `backend/src/services/`
4. Resolver → `backend/src/graphql/resolvers/` + register in `mod.rs` QueryRoot/MutationRoot
5. GraphQL type if new → `backend/src/graphql/types/`
6. Frontend query/mutation → `frontend/src/lib/graphql/`
7. Component/page → `frontend/src/pages/` or `frontend/src/components/`
8. Translations → both `pt.json` and `en.json`

## Environment Variables

### Backend (`backend/.env`)
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `PORT` (default 8080), `ALLOWED_ORIGINS`, `RUST_LOG`

### Frontend (`frontend/.env`)
`VITE_GRAPHQL_ENDPOINT` (e.g., `http://localhost:8080/graphql`)
