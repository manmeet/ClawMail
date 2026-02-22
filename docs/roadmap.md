# What’s Left (Roadmap)

This is the practical backlog to move ClawMail from strong prototype to production-grade product.

## 0. Current State Summary
Done:
- keyboard-first email shell
- Gmail OAuth + sync integration
- thread open/reply/send/archive/read/snooze flows
- command palette + esc hierarchy
- tablet slide-over agent panel
- regression test scripts with broad UI coverage

Not done:
- production auth/session model
- durable data model and background jobs
- fully integrated OpenClaw task execution loop
- production security and observability hardening

## 1. P0: Production Foundation

### 1.1 Auth + Identity
- Add real user auth (Google sign-in or enterprise SSO)
- Bind mailbox/account data to authenticated user
- Remove implicit single-user global state

### 1.2 Persistent Data Layer
- Introduce DB (Postgres recommended)
- Persist:
  - accounts/connectors
  - thread metadata and sync cursors
  - drafts/tasks/agent actions
  - approvals and audit events

### 1.3 Background Workers
- Queue for sync and connector jobs
- Retry policy and dead-letter handling
- Incremental sync strategy per connector

### 1.4 Secrets + Config
- Move secrets out of local `.env` into managed secret store in deployment
- Environment validation on boot (required vars + fail-fast)

## 2. P0: API and Domain Hardening

### 2.1 Contract Alignment
- Ensure all implemented routes are fully represented in `api/openapi.yaml`
- Generate typed clients from OpenAPI
- Add route-level tests for request/response schema conformance

### 2.2 Error Model
- Standardize error shape across all routes
- Add typed error codes (`AUTH_REQUIRED`, `SCOPE_MISSING`, `RATE_LIMITED`, etc.)
- Add recoverability hints for frontend UX

### 2.3 Pagination + Filtering
- Add cursor pagination for thread list and message history
- Support stable sorting keys and server-side filter syntax

## 3. P1: Email Fidelity and Reliability

### 3.1 Thread Fidelity
- Keep list and open thread state consistent during async updates
- Add server-confirmed merge behavior after send/archive/read actions
- Handle multi-message thread loading and partial failures gracefully

### 3.2 Compose + Drafts
- Autosave draft cadence
- Draft versioning / conflict strategy
- Attachment upload + rendering

### 3.3 Connector Multiplexing
- Proper account instances (not only UI tabs)
- Per-account token/state and activity indicators
- Account switch isolation and caching

## 4. P1: Claw Agent Integration

### 4.1 Execution Loop
- Replace placeholder agent panel actions with real OpenClaw invocation
- Add deterministic tool-call traces and action statuses

### 4.2 Policy + Approval UX
- Surface approval-required actions in UI with clear state
- Add tokenized approve/reject flow and expiration handling

### 4.3 Context Connectors
- Wire additional connectors (Drive, Notes, Notion, etc.)
- Expose source attribution in generated drafts/actions

## 5. P1: Security and Compliance

- Prompt-injection guards for inbound content
- Strict tool allowlists and action intent validation
- Tenant/user data isolation checks
- Immutable audit event persistence
- Privacy controls and data retention policy

## 6. P2: Frontend Quality

### 6.1 Componentization
- Split `InboxShell` into smaller composable units:
  - top bar
  - list pane
  - thread workspace
  - reply dock
  - agent pane
  - command palette

### 6.2 Unit/Integration Tests
- Add React-level tests for state transitions
- Keep Playwright suites as end-to-end smoke layer

### 6.3 Accessibility
- Add robust ARIA roles and focus management around overlays
- Verify contrast + reduced-motion behavior

## 7. P2: Ops and Observability

- Structured logs with request IDs
- Metrics for sync jobs and mail actions
- Error tracking (frontend + backend)
- Health checks and readiness checks for deployment

## Suggested Execution Order
1. Auth + DB + worker queue
2. API contract alignment + pagination
3. Real OpenClaw action execution + approvals
4. Security/compliance hardening
5. Frontend componentization + broader test pyramid
6. Production deployment + observability
