# New Modular "Curriculum" Flow: Step-by-Step

## Phase 1: Setup & Data Ingestion

### Step 1: Session Initialization
* **User Action:** User clicks "Nova Sessão" and defines the goal (e.g., "Physics 1 Final").
* **System:** Creates a generic session entry.

### Step 2: Document Upload
* **User Action:** Uploads professor slides, notes, and past exams.
* **System:** Performs the high-fidelity extraction (PDF → Image → Vision API → Text/LaTeX) as established. All documents are linked to the Session.

## Phase 2: Interactive Planning (The Curriculum)

### Step 3: Plan Generation
* **User Action:** Clicks "Generate Plan".
* **System:** The AI analyzes all uploaded content to deduce the syllabus. It generates a structured list of Topics.
* **Data Structure:** A Topic entity is created for each item, initially status: pending.

### Step 4: Knowledge Check (Pre-filtering)
* **User Action:** The user sees the list of topics.
* **UI:** Each topic has a prominent "Check box".
* **Interaction:** The user ticks boxes for topics they already know.
* **System:** These topics are marked as completed immediately in the database.

### Step 5: Plan Refinement
* **User Action:** User types in the text box below the list: "Split 'Thermodynamics' into two topics and remove 'Optics' because it's not on this exam."
* **System:** The AI regenerates the list structure based on the feedback while keeping the user's "Completed" checks where possible.

### Step 6: Plan Confirmation
* **User Action:** User clicks "Start Studying".
* **System:** The planning phase locks. The application generates Chat Threads for every topic (plus one "Review/Practice" thread).

## Phase 3: The Study Dashboard (The Map)

### Step 7 & 8: The "Cards" View
* **Visual Experience:** The user lands on the Session Main Page.
* **UI Layout:** A grid or list of Cards.
    * **Cards (Topics):** One card for each generated topic.
    * **Card (Review):** One special card at the end for "General Review/Practice".
* **Card States:**
    * **Not Started:** Clean look.
    * **Started:** Visual indicator (e.g., "In Progress" badge) if messages exist in that thread.
    * **Completed:** Dimmed/Green checkmark if marked done.

### Step 9: Topic Management
* **User Action:** On the card itself, the user can tick a box to mark the whole topic/chat as completed without entering it.
* **System:** Updates the topic status in the database.

## Phase 4: The Topic-Specific Chat

### Step 10: Entering a Topic
* **User Action:** User clicks a card (e.g., "Derivatives").
* **System:** Opens the chat interface specific to that Topic ID.
* **Completion Flow:** When the AI detects the student has mastered the concept, it sends a suggested action: "We've covered everything here. Shall we mark this as complete and move to the next topic?"
* **Transition:** If it's the last topic, AI suggests moving to the "Review Chat".

### Step 11: Context & Intelligence
* **System Prompting:** The AI instructions are now strictly scoped.
    * **Scope:** "You are teaching [Current Topic Name]. Do not veer into other topics unless necessary for context."
    * **Global Access:** The AI can read all uploaded documents.
    * **Exam Strategy:** The AI is explicitly instructed: "Search the uploaded 'Past Exams' documents for questions related to [Current Topic Name] and use them as practice problems."
    * **Memory:** It only sees the history of this specific chat, keeping the context clean.

## Phase 5: Integrated Navigation

### Step 12: The Sidebar Navigation
* **Visual Experience:** Inside the chat, the sidebar is no longer just documents.
* **UI:** It contains a "Study Plan" tab.
    * Lists all other Topics (like a Table of Contents).
    * Shows their status (Completed/Started).
* **Interaction:** User realizes they are stuck on "Integrals" because they forgot "Derivatives".
* **Action:** User clicks "Derivatives" in the sidebar.
* **System:** Instantly switches the chat context to the "Derivatives" thread without forcing the user back to the main dashboard.




# Database Schema Specification

We are building a study platform with a modular curriculum architecture. Please design the database schema (PostgreSQL) based on the following specifications.

## 1. Enums & Types
We need these specific enumerated types to handle state:

* **SessionStatus**: `PLANNING` (initial state), `ACTIVE` (studying), `COMPLETED`.
* **ChatType**: `TOPIC_SPECIFIC` (for learning a specific subject), `GENERAL_REVIEW` (for the final exam simulation).
* **ProcessingStatus**: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` (for document uploads).

## 2. Tables & Relationships

### A. Core User & Session
**Table: `profiles`**
* `id` (UUID, PK)
* `email` (String, Unique)
* `password_hash` (String)
* `created_at` (Timestamp)

**Table: `study_sessions`**
* `id` (UUID, PK)
* `profile_id` (FK to profiles)
* `title` (String) - e.g., "Calculus 1 Final"
* `Description` (String) - e.g., "It will happen Friday, I need to study a lot"
* `status` (Enum: SessionStatus) - Default: `PLANNING`
* `draft_plan` (JSON/JSONB) - Nullable. This stores the temporary AI-generated curriculum structure *before* the user confirms it.
* `created_at`, `updated_at` (Timestamps)

### B. Content Management
**Table: `documents`**
* `id` (UUID, PK)
* `session_id` (FK to study_sessions, Cascade Delete)
* `file_name` (String)
* `file_path` (String) - The path in the Supabase storage bucket.
* `content_text` (Text) - Nullable. Stores the massive text content extracted from PDFs.
* `content_lengh` (Int) - Nullable.
* `processing_status` (Enum: ProcessingStatus) - Default: `PENDING`.
* `created_at` (Timestamp)

### C. Curriculum & Navigation
**Table: `topics`**
* `id` (UUID, PK)
* `session_id` (FK to study_sessions, Cascade Delete)
* `title` (String)
* `description` (String, Nullable)
* `order_index` (Int) - Crucial for ordering the curriculum path (1, 2, 3...).
* `is_completed` (Boolean) - Default: `false`. Marks if the user "tested out" of this topic during planning.
* `created_at`, `updated_at` (Timestamps)

### D. Chat System
**Table: `chats`**
* `id` (UUID, PK)
* `session_id` (FK to study_sessions, Cascade Delete)
* `type` (Enum: ChatType)
* `topic_id` (FK to topics, Nullable, Unique)
    * *Logic*: If `type` is TOPIC_SPECIFIC, this must be linked to a Topic. If `type` is GENERAL_REVIEW, this is null.
* `is_started` (Boolean) - Default: `false`. True if user sent at least one message.
* `created_at`, `updated_at` (Timestamps)

**Table: `messages`**
* `id` (UUID, PK)
* `chat_id` (FK to chats, Cascade Delete)
* `role` (String) - 'user' or 'assistant'.
* `content` (Text) - The message body.
* `created_at` (Timestamp)

