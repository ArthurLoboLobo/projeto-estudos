# Step 11: Frontend — Replace Apollo with TanStack Query + API Client

**Status:** PENDING

**Prerequisites:** Step 10 completed (full backend working)

---

## Before you start

Read these files:
- `implementation-plan/improve.md` — see "Frontend Migration: GraphQL → REST" section
- `implementation-plan/step-10-chat-with-rag.md` — read the Completion Notes for any API changes
- `frontend/src/lib/apollo.ts` — understand current Apollo setup
- `frontend/src/lib/graphql/queries.ts` — understand current query patterns
- `frontend/src/lib/graphql/mutations.ts` — understand current mutation patterns

## Task

Replace Apollo Client with TanStack Query and create a fetch-based API client. This step is **infrastructure only** — don't migrate pages yet (that's steps 12-15).

### 1. Install Dependencies

```bash
cd frontend
npm uninstall @apollo/client graphql
npm install @tanstack/react-query
```

### 2. API Client (`frontend/src/lib/api.ts`)

Create a typed fetch wrapper:

```typescript
const API_BASE = import.meta.env.VITE_API_URL; // e.g., http://localhost:8080

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('caky_token');
    const language = localStorage.getItem('language') || 'pt';
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'x-language': language,
    };
  }

  async get<T>(path: string): Promise<T> { ... }
  async post<T>(path: string, body?: unknown): Promise<T> { ... }
  async put<T>(path: string, body?: unknown): Promise<T> { ... }
  async delete(path: string): Promise<void> { ... }

  async uploadFile(path: string, file: File, extraFields?: Record<string, string>): Promise<T> {
    // Multipart form upload — don't set Content-Type (browser sets boundary)
  }
}

export const api = new ApiClient();
```

### 3. SSE Helper (`frontend/src/lib/sse.ts`)

Create an EventSource wrapper for SSE endpoints:

```typescript
interface SSEOptions<T> {
  url: string;
  onEvent: (event: string, data: T) => void;
  onError?: (error: Event) => void;
  onComplete?: () => void;
}

export function connectSSE<T>(options: SSEOptions<T>): () => void {
  // Create EventSource with auth token in URL params (EventSource doesn't support headers)
  // OR use fetch with ReadableStream for SSE (supports headers)
  // Parse events, call onEvent
  // Return cleanup function
}
```

**Note:** The native `EventSource` API doesn't support custom headers. Two options:
- Pass the JWT as a query parameter: `GET /sessions/{id}/generate-plan?token=xxx`
- Use `fetch` with a `ReadableStream` reader to parse SSE manually (supports headers)

Choose the `fetch` approach (more secure — no token in URLs/logs). Document your choice.

### 4. Query Provider (`frontend/src/main.tsx` or `App.tsx`)

Replace `ApolloProvider` with `QueryClientProvider`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});
```

### 5. Update environment variable

Rename `VITE_GRAPHQL_ENDPOINT` to `VITE_API_URL` in `.env` and `.env.example`:
```
VITE_API_URL=http://localhost:8080
```

### 6. Remove old GraphQL files

Delete:
- `frontend/src/lib/apollo.ts`
- `frontend/src/lib/graphql/queries.ts`
- `frontend/src/lib/graphql/mutations.ts`

### 7. Keep auth context working

Update `frontend/src/lib/auth.tsx` to use the new API client instead of Apollo mutations. The auth context should still provide `login`, `register`, `logout`, and `isAuthenticated`.

## Acceptance Criteria

- [ ] Apollo Client fully removed (no `@apollo/client` in package.json)
- [ ] TanStack Query set up with QueryClientProvider
- [ ] API client handles auth headers, language header, error responses
- [ ] SSE helper works with custom headers (fetch-based, not EventSource)
- [ ] File upload function works with multipart/form-data
- [ ] Auth context works with the new API client
- [ ] App still boots (pages may be broken — that's expected, fixed in next steps)

## When you're done

Edit this file:
1. Change **Status** to `COMPLETED`
2. Fill in the **Completion Notes** section below

---

## Completion Notes

_To be filled by Claude after completing this step._
