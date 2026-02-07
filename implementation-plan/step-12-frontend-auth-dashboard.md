# Step 12: Frontend — Auth + Dashboard Pages

**Status:** PENDING

**Prerequisites:** Step 11 completed

---

## Before you start

Read these files:
- `implementation-plan/step-11-frontend-api-client.md` — read the Completion Notes for API client usage patterns
- `frontend/src/pages/Auth.tsx` — current auth page
- `frontend/src/pages/Dashboard.tsx` — current dashboard page

## Task

Migrate the Auth and Dashboard pages to use the new REST API with TanStack Query.

### 1. Auth Page (`frontend/src/pages/Auth.tsx`)

- Replace Apollo `useMutation` with the auth context methods (which now use the API client from step 11)
- `POST /auth/register` and `POST /auth/login`
- Error handling: show toast on failure
- On success: store token, navigate to dashboard
- The UI/layout should stay the same — just replace the data layer

### 2. Dashboard Page (`frontend/src/pages/Dashboard.tsx`)

Replace Apollo queries/mutations with TanStack Query:

```typescript
// List sessions
const { data: sessions, isLoading } = useQuery({
  queryKey: ['sessions'],
  queryFn: () => api.get<Session[]>('/sessions'),
});

// Create session
const createSession = useMutation({
  mutationFn: (data: CreateSessionRequest) => api.post('/sessions', data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
});

// Delete session
const deleteSession = useMutation({
  mutationFn: (id: string) => api.delete(`/sessions/${id}`),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
});
```

- Keep the same UI components and layout
- Replace loading/error states (Apollo's `loading`/`error` → TanStack's `isLoading`/`isError`)

### 3. Update Types (`frontend/src/types/index.ts`)

Update TypeScript interfaces to match the new REST API response shapes. The responses are now flat JSON (not wrapped in GraphQL `data` objects):

- `Session` — matches `SessionResponse` from the Python backend
- `User` — matches `UserResponse`
- Remove any GraphQL-specific types

### 4. Landing Page (`frontend/src/pages/Landing.tsx`)

This page likely doesn't use any data fetching, but check for any GraphQL imports and remove them.

## Acceptance Criteria

- [ ] Auth page works: register and login with the new REST API
- [ ] Dashboard lists sessions, creates new ones, deletes them
- [ ] Loading and error states work correctly
- [ ] No remaining Apollo imports in these pages
- [ ] Types updated to match REST API responses

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
