# Step 10: Chat Endpoints with RAG + Streaming

**Status:** PENDING

**Prerequisites:** Step 09 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 5 (Chat with AI / RAG), Context Management, and Context Window Management sections
- `implementation-plan/step-09-rag-retrieval.md` — read the Completion Notes
- `backend/src/prompts.rs` — reference existing prompt templates (adapt for new system)

## Task

Implement chat endpoints: send messages with RAG context, stream AI responses via SSE, manage conversation history with summarization.

### 1. Chat Service (`app/services/chat.py`)

#### System Prompt Building:

Build different system prompts based on chat type:

**Topic-specific chat:**
- Study plan overview (all topic titles)
- Current topic: title + subtopics
- RAG context (from retrieval service)
- Language instruction: "You MUST respond in **{language}**"
- Pedagogical guidelines (adapt from existing `prompts.rs`)

**General review chat:**
- Study plan overview (all topics)
- RAG context (global search)
- Language instruction
- Review-mode guidelines

#### Conversation History Management:

```python
async def get_chat_context(chat_id: UUID, db: AsyncSession) -> tuple[str, list[dict]]:
    """
    Returns (summary, recent_messages).

    - Fetch all messages for the chat, ordered by created_at
    - If <= 10 messages: return ("", all_messages)
    - If > 10 messages:
        - Check if a summary already exists (system message at the start)
        - If stale (more new messages since last summary): regenerate
        - Summarize older messages into ~200-300 token summary (use `settings.MODEL_SUMMARY`)
        - Save summary as a system message (replace previous if exists)
        - Return (summary, last 6-8 messages)
    """
```

The summary is stored as a `system` role message in the messages table (first message in the chat). When the summary is regenerated, update this message.

#### Send Message Flow:

```python
async def send_message_stream(chat_id: UUID, content: str, user_id: UUID, language: str, db: AsyncSession) -> AsyncIterator[str]:
    # 1. Save user message to DB
    # 2. Get chat + topic + session info
    # 3. Get conversation context (summary + recent messages)
    # 4. Embed query and retrieve RAG context
    # 5. Build system prompt
    # 6. Call ai_client.generate_text_stream(..., model=settings.MODEL_CHAT) with system prompt + history + user message
    # 7. Stream tokens to client
    # 8. When stream completes, save full AI response to DB
    # 9. Mark chat as started (is_started = true)
```

### 2. Chat Schemas (`app/schemas/chat.py`)

- `ChatResponse(id, session_id, type, topic_id, is_started, created_at)`
- `MessageResponse(id, chat_id, role, content, created_at)`
- `SendMessageRequest(content: str)`

### 3. Chat Router (`app/routers/chat.py`)

- **`GET /sessions/{id}/chats`**: List chats for a session
  - Verify session ownership
  - Return all chats with their type and topic_id

- **`GET /chats/{id}`**: Get chat details
  - Verify ownership (chat → session → profile_id)

- **`GET /chats/{id}/messages`**: Get message history
  - Verify ownership
  - Return messages ordered by `created_at`
  - Exclude system messages (summaries) from the response

- **`POST /chats/{id}/messages`**: Send message + stream AI response (SSE)
  - Verify ownership
  - Accept `SendMessageRequest`
  - Return `StreamingResponse` with `text/event-stream`
  - Events: `{"event": "token", "data": {"content": "..."}}`
  - Final event: `{"event": "completed", "data": {"message": {full MessageResponse}}}`

- **`DELETE /chats/{id}/messages`**: Clear chat history
  - Verify ownership
  - Delete all messages for the chat
  - Reset `is_started` to false

### 4. Topic Endpoints (`app/routers/topics.py`)

- **`GET /sessions/{id}/topics`**: List topics with completion status
  - Verify session ownership

- **`PUT /topics/{id}`**: Update topic completion
  - Verify ownership (topic → session → profile_id)
  - Update `is_completed`

### 5. Welcome Message (`app/services/chat.py`)

When a chat is first opened (`is_started == false`), the frontend can call `POST /chats/{id}/messages` with a special empty content or a `generate-welcome` endpoint. Or simpler: the first time the chat is opened, the frontend sends an automatic first message like "Introduce this topic" and the AI responds.

Choose whichever approach is simpler. Document your choice in the completion notes.

### 6. Register routers in main.py

## Acceptance Criteria

- [ ] Chat listing and message history endpoints work
- [ ] Send message streams AI response via SSE
- [ ] RAG context is included in the AI prompt
- [ ] System prompts differ for topic-specific vs general review
- [ ] Conversation summarization kicks in after 10+ messages
- [ ] Summary stored as system message, excluded from API responses
- [ ] Topic completion update works
- [ ] Clear messages works and resets chat state
- [ ] All endpoints have proper authorization

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
