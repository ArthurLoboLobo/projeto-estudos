# Step 13: Frontend — Upload Page

**Status:** PENDING

**Prerequisites:** Step 12 completed

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see Phase 1 (Upload Materials), file size limits
- `implementation-plan/step-12-frontend-auth-dashboard.md` — read the Completion Notes
- `frontend/src/pages/SessionUpload.tsx` — current upload page

## Task

Migrate the upload page to use the new REST API. This page handles document uploads and shows extraction progress.

### 1. Upload Page (`frontend/src/pages/SessionUpload.tsx`)

Replace Apollo queries/mutations with TanStack Query + API client:

- **List documents:** `useQuery` → `GET /sessions/{id}/documents`
- **Upload file:** `useMutation` → `api.uploadFile('/sessions/{id}/documents', file)`
- **Delete document:** `useMutation` → `DELETE /sessions/{id}/documents/{docId}`

### 2. Polling for Extraction Status

Documents have a `processing_status` that transitions: `PENDING → PROCESSING → COMPLETED/FAILED`.

Use TanStack Query's `refetchInterval` to poll:

```typescript
const { data: documents } = useQuery({
  queryKey: ['documents', sessionId],
  queryFn: () => api.get(`/sessions/${sessionId}/documents`),
  refetchInterval: (query) => {
    // Poll every 3s if any document is still processing
    const docs = query.state.data;
    const hasProcessing = docs?.some(d => d.processing_status !== 'COMPLETED' && d.processing_status !== 'FAILED');
    return hasProcessing ? 3000 : false;
  },
});
```

### 3. File Validation (Client-Side)

Before uploading, check:
- File is PDF (check MIME type)
- File size <= 25MB
- Total session files <= 150MB (sum current documents + new file)
- Show error toast if validation fails

### 4. "Finish" Button

- Disabled until: at least 1 document is `COMPLETED` AND no documents are `PENDING` or `PROCESSING`
- On click: navigate to the plan generation page (which calls the SSE endpoint)

### 5. Session Status

This page should only be accessible when session status is `UPLOADING`. If the session is in another status, redirect to the appropriate page.

## Acceptance Criteria

- [ ] File upload works via REST multipart endpoint
- [ ] Document list shows with status badges (PENDING, PROCESSING, COMPLETED, FAILED)
- [ ] Polling updates document status automatically
- [ ] Client-side file validation (PDF, size limits)
- [ ] "Finish" button logic works correctly
- [ ] Delete document works
- [ ] No remaining Apollo imports

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
