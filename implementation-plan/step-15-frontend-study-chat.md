# Step 15: Frontend — Study Page + Chat (Streaming)

**Status:** PENDING

**Prerequisites:** Step 14 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 4 (Create Chunks), Phase 5 (Study), and the session status flow
- `implementation-plan/step-14-frontend-plan-pages.md` — read the Completion Notes
- `frontend/src/pages/Session.tsx` — current session page (study view)
- `frontend/src/components/ui/Markdown.tsx` — existing markdown renderer with LaTeX support

## Task

Create the chunking progress page and migrate the study/chat interface to use the new REST + SSE endpoints.

### Page 1: Chunking Progress Page

A transitional page (like the plan generation page) that shows chunking progress.

**Route:** Shown when session status is `CHUNKING`

**UI:**
- "Preparing your study materials..." heading
- Progress: "Processing document 2/5..."
- Auto-navigates to study page when done
- Error state with "Retry" button

**Implementation:** Same SSE pattern as plan generation page:
```typescript
connectSSE({
  url: `/sessions/${sessionId}/create-chunks`,
  onEvent: (event, data) => {
    if (event === 'document_chunked') setProgress(data);
    if (event === 'completed') navigate(`/session/${sessionId}`);
  },
});
```

### Page 2: Study Page

The main study interface. Shown when session status is `ACTIVE` or `COMPLETED`.

**Layout:**
- **Sidebar** (collapsible, resizable):
  - Topic list with completion status (checkboxes)
  - Click topic → opens its chat
  - "General Review" button at the bottom → opens review chat
- **Main area:** Chat panel for the selected topic/review

**Data fetching:**
```typescript
// Topics
const { data: topics } = useQuery({
  queryKey: ['topics', sessionId],
  queryFn: () => api.get(`/sessions/${sessionId}/topics`),
});

// Chats
const { data: chats } = useQuery({
  queryKey: ['chats', sessionId],
  queryFn: () => api.get(`/sessions/${sessionId}/chats`),
});

// Messages for selected chat
const { data: messages } = useQuery({
  queryKey: ['messages', selectedChatId],
  queryFn: () => api.get(`/chats/${selectedChatId}/messages`),
  enabled: !!selectedChatId,
});
```

### Chat Component

The chat component handles message display and SSE streaming:

**Message display:**
- Render messages with the existing `Markdown` component (supports LaTeX/KaTeX)
- User messages aligned right, AI messages aligned left
- Show loading indicator while AI is streaming

**Sending a message:**
```typescript
async function sendMessage(content: string) {
  // Optimistically add user message to UI
  // Connect to SSE: POST /chats/{chatId}/messages with body {content}
  // As tokens arrive: append to a streaming message in the UI
  // On completed event: replace streaming message with final message
  // Invalidate messages query to sync with server
}
```

**Streaming UX:**
- While streaming: show the AI message building up token by token
- Disable the send button while streaming
- Show a typing indicator or cursor at the end of the streaming message

### Topic Completion

- Checkbox next to each topic in the sidebar
- On toggle: `PUT /topics/{topicId}` with `{ is_completed: true/false }`
- Invalidate topics query to update UI

### Clear Chat

- Button in the chat header to clear conversation
- `DELETE /chats/{chatId}/messages`
- Refresh messages

### Session Router (`frontend/src/pages/Session.tsx`)

Update the main Session component to route based on the new status enum:

```typescript
switch (session.status) {
  case 'UPLOADING': return <SessionUpload />;
  case 'GENERATING_PLAN': return <PlanGeneration />;
  case 'EDITING_PLAN': return <PlanEditing />;
  case 'CHUNKING': return <ChunkingProgress />;
  case 'ACTIVE':
  case 'COMPLETED': return <SessionStudying />;
}
```

### Interrupted Process Handling

If the user navigates to a session with status `GENERATING_PLAN` or `CHUNKING` (was interrupted):
- Show "Processing was interrupted" message
- Provide a "Retry" button that calls the SSE endpoint again

## Acceptance Criteria

- [ ] Chunking progress page streams progress and auto-navigates
- [ ] Study page shows topic list with completion toggles
- [ ] Chat messages render with Markdown + LaTeX support
- [ ] Chat streaming works via SSE (tokens appear incrementally)
- [ ] Send button disabled during streaming
- [ ] Topic completion toggle works
- [ ] Clear chat works
- [ ] Session router handles all 6 status values
- [ ] Interrupted process detection with retry
- [ ] Sidebar is collapsible and responsive
- [ ] General review chat accessible
- [ ] No remaining Apollo imports anywhere in the frontend

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
