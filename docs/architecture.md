# ClawMail Architecture

## 1. System Overview
ClawMail is a two-app monorepo:
- `apps/web`: Next.js frontend for inbox UX
- `apps/server`: Express API server for mail operations, Gmail integration, and policy/audit scaffolding

The current runtime model is:
1. Frontend calls server REST endpoints.
2. Server prefers live Gmail operations when OAuth is connected.
3. Server falls back to local mock repositories when Gmail is unavailable or permission-limited.
4. Frontend renders optimistic state for responsiveness, then refreshes list data.

## 2. Frontend Architecture (`apps/web`)

### 2.1 Main UI Container
`src/components/InboxShell.tsx` owns primary UI state:
- mailbox folder selection
- thread list + selected row
- open thread detail + loading/error states
- compose/reply dock state
- command palette and drawer visibility
- connector status and top account tabs

### 2.2 UI Regions
- Top bar:
  - account tabs (connected and manually-added instances)
  - connect/sync controls
  - tablet-only `Claw Agent` toggle
- Left rail:
  - brand glyph
  - drawer toggle
  - quick compose
- Drawer:
  - folder navigation
- Center pane:
  - list view OR thread workspace
  - bottom reply dock for thread replies
  - floating compose for new email
- Right pane:
  - `Claw Agent` panel
  - on tablet: slide-over panel with scrim

### 2.3 Keyboard Model
Global keydown handler in `InboxShell` supports:
- navigation (`j/k`, `Enter`, `u`)
- composition (`c`, `r`, `a`, `Cmd/Ctrl+Enter`)
- actions (`e`, `h`, `x`)
- command palette (`Cmd/Ctrl+K`)
- search focus (`/`)
- hierarchical `Esc` close logic

### 2.4 UI Test Architecture
Playwright smoke scripts in `apps/web`:
- `ui-fake-thread-reply-check.mjs`: deterministic mocked flow for thread reply append
- `ui-full-email-check.mjs`: broad baseline UI/interaction suite
- `ui-extended-email-check.mjs`: additional keyboard/regression checks

## 3. Backend Architecture (`apps/server`)

### 3.1 Entry + Routing
`src/index.ts` wires middleware and route modules:
- `routes/inbox.ts`, `routes/agent.ts`, `routes/drafts.ts`, `routes/tasks.ts`, etc.
- Gmail-related routes:
  - `routes/auth.ts`
  - `routes/connector.ts`
  - `routes/sync.ts`
  - `routes/mail.ts`

### 3.2 Service Layer
Core services:
- `services/gmail-auth.ts`:
  - OAuth URL generation
  - code exchange
  - token persistence (`apps/server/.data/gmail-token.json`)
- `services/gmail-sync.ts`:
  - thread ingestion from Gmail to local repository model
- `services/gmail-mail.ts`:
  - list/get threads
  - draft create/send
  - message send
  - thread action mutations
  - fallback behavior on missing scopes or no connection
- `services/repositories.ts`:
  - in-memory mock threads/messages/drafts/tasks
  - fallback operations
- `services/policy-engine.ts` and `services/audit-log.ts`:
  - scaffolding for policy and event records

### 3.3 Data Strategy (Current)
There is no production database yet.
Current persistence is mixed:
- OAuth token persisted to local filesystem
- most mail/task/draft state in-memory (resets on process restart)

This is suitable for prototyping, not production.

## 4. API Architecture
OpenAPI draft: `api/openapi.yaml`.

Implemented APIs cover:
- mail thread list/detail
- mail actions (archive/read/unread/snooze/trash)
- drafts/send
- Gmail OAuth lifecycle
- connector status
- sync endpoint

Contract and implementation are close but not perfectly unified yet; this is tracked in roadmap.

## 5. Security and Trust Boundaries

### 5.1 Trust Boundaries
- Browser <-> local API server
- API server <-> Gmail API
- local filesystem token cache

### 5.2 Current Controls
- typed payload validation via Zod on key routes
- policy and audit hooks exist
- no production auth/session layer yet

### 5.3 Key Gaps
- no user/session isolation
- no secret manager integration
- no DB-backed audit immutability
- no multi-tenant auth boundaries

## 6. Operational Flow (Today)

### 6.1 Connect Gmail
1. frontend `startGoogleAuth()`
2. server returns Google OAuth URL
3. callback exchanges code and stores token
4. connector status reflects connection state

### 6.2 Read + Act on Email
1. frontend fetches list (`/v1/mail/threads`)
2. open thread (`/v1/mail/threads/:id`) marks read
3. user action (`archive/read/unread/...`) posts to actions endpoint
4. UI applies local state updates and refreshes list as needed

### 6.3 Reply Flow
1. open thread
2. `r` or `a` opens reply dock
3. send via button or `Cmd/Ctrl+Enter`
4. UI appends sent message locally in open thread and syncs list metadata

## 7. Known Tradeoffs (Current)
- some UI behavior is intentionally optimistic for speed
- fallback mode can diverge slightly from Gmail-native behavior
- script-based UI validation is strong for smoke coverage but not a replacement for unit/integration testing

## 8. Recommended Next Architectural Steps
1. add persistent data store (threads, drafts, actions, audit)
2. add auth/session boundary and account-scoped data model
3. unify API contract + implementation and generate typed clients
4. introduce background sync workers and retry queue
5. formalize OpenClaw orchestration executor with policy gates + approval workflows
