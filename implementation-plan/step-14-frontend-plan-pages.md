# Step 14: Frontend — Plan Generation + Plan Editing Pages

**Status:** PENDING

**Prerequisites:** Step 13 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 2 (Generate Study Plan) and Phase 3 (Edit Study Plan) thoroughly
- `implementation-plan/step-11-frontend-api-client.md` — read Completion Notes for SSE helper usage
- `implementation-plan/step-13-frontend-upload-page.md` — read the Completion Notes
- `frontend/src/pages/SessionPlanning.tsx` — current planning page (will be heavily modified)

## Task

Create two new pages: one for plan generation (SSE progress) and one for plan editing (full editing capabilities).

### Page 1: Plan Generation Page

A transitional page that shows progress while the backend generates the plan via SSE.

**Route:** `/session/:id/generating` (or handle within the Session component based on status)

**UI:**
- "Generating study plan..." heading
- Progress indicator: "Processing document 2/5..."
- The plan building up in real-time (show topics appearing as each document is processed)
- No user interaction needed — auto-navigates to edit page when done
- Error state: "Something went wrong" with a "Retry" button

**Implementation:**
```typescript
// Connect to SSE endpoint
const cleanup = connectSSE({
  url: `/sessions/${sessionId}/generate-plan`,
  onEvent: (event, data) => {
    if (event === 'document_processed') {
      setProgress({ current: data.doc, total: data.total });
      setPlan(data.plan);
    }
    if (event === 'completed') {
      navigate(`/session/${sessionId}`); // Will show edit page
    }
  },
  onError: () => setError(true),
});
```

### Page 2: Plan Editing Page

The main interactive page where users review and modify their study plan.

**Route:** Shown when session status is `EDITING_PLAN`

**UI Elements:**

1. **Topic List** — vertical list of topic cards, each showing:
   - Drag handle (for reordering)
   - Topic title (click to edit inline)
   - Subtopics list (each clickable to edit inline)
   - "+" button to add subtopic
   - "x" button on each subtopic (on hover) to delete
   - Checkbox to mark "already know" (toggles `is_completed`)
   - Delete topic button

2. **Add Topic Button** — at the bottom of the list, opens inline form

3. **Drag-and-Drop** — for reordering topics. Use a library like `@dnd-kit/core` or `react-beautiful-dnd` (or `@hello-pangea/dnd` which is the maintained fork). `order_index` updates automatically on reorder.

4. **AI Chat Box** — small chat panel (bottom or side) for AI modifications:
   - User types: "merge topics 3 and 4"
   - Calls `POST /sessions/{id}/revise-plan` with the instruction
   - **Lock the topic list** while AI is processing (show loading overlay)
   - When response arrives, update the plan display

5. **Undo/Redo** — track plan states in an array:
   ```typescript
   const [history, setHistory] = useState<DraftPlan[]>([initialPlan]);
   const [historyIndex, setHistoryIndex] = useState(0);
   // Push to history on every edit action
   // Undo: historyIndex--
   // Redo: historyIndex++
   ```
   - Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
   - Undo/Redo buttons in the toolbar

6. **"Continue" Button** — saves the final plan:
   - Calls `PUT /sessions/{id}/plan` with the current plan
   - Navigates to the chunking progress page

7. **Validation** — show warnings:
   - If any topic has 0 subtopics
   - If there are 0 topics total
   - Disable "Continue" if validation fails

### Data Flow:

- Load initial plan: `GET /sessions/{id}/plan` → use as initial state
- All edits happen **client-side** (no API calls until save or AI revision)
- AI revision: `POST /sessions/{id}/revise-plan` → replaces current plan state (clears undo history or pushes as new state)
- Save: `PUT /sessions/{id}/plan` → creates topics/chats in DB

## Acceptance Criteria

- [ ] Plan generation page streams progress via SSE
- [ ] Plan generation auto-navigates to edit page on completion
- [ ] Plan editing: inline edit titles and subtopics
- [ ] Plan editing: add/delete topics and subtopics
- [ ] Plan editing: drag-and-drop reorder
- [ ] Plan editing: toggle "already know" per topic
- [ ] AI revision chat works, locks UI during processing
- [ ] Undo/Redo works (keyboard shortcuts + buttons)
- [ ] Validation prevents "Continue" with empty plan or empty subtopics
- [ ] "Continue" saves plan and navigates to chunking
- [ ] Error handling with retry options

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
