# ClawMail

ClawMail is a keyboard-first executive inbox client with a built-in agent panel.

Current status:
- Functional email client shell (list, open thread, reply dock, compose, archive/read/snooze actions)
- Gmail OAuth + sync integration
- API/server scaffolding for OpenClaw orchestration and policy/audit pipeline
- High-coverage Playwright smoke suites for core UI interactions

## Repository Structure
- `apps/web`: Next.js + React frontend
- `apps/server`: Express + TypeScript backend
- `api/openapi.yaml`: API contract (OpenAPI-style)
- `docs/ia-route-component-tree.md`: IA and component tree draft
- `docs/architecture.md`: architecture and runtime flow
- `docs/setup.md`: local setup and operations
- `docs/roadmap.md`: what remains to ship production-grade ClawMail

## Product Capabilities (Current)
- Inbox-first, keyboard-driven workflow:
  - `j/k` navigate, `Enter/o` open, `u` back, `r/a` reply, `e` archive, `/` search
  - `Cmd/Ctrl+K` command palette
  - hierarchical `Esc` behavior
- Single-center thread workspace with bottom reply dock
- Right-side `Claw Agent` panel
- Gmail connect/sync entry points
- Draft/send flows (with graceful fallback behavior)

## Tech Stack
- Frontend:
  - Next.js 14
  - React 18
  - TypeScript
  - Playwright (UI smoke tests)
- Backend:
  - Node.js + Express
  - TypeScript
  - Zod request validation
  - Google APIs (OAuth + Gmail)

## Quick Start
Use the detailed guide: `docs/setup.md`.

Fast path:

1. Install dependencies
```bash
cd /Users/manmeetmaggu/ClawMail/apps/server && npm install
cd /Users/manmeetmaggu/ClawMail/apps/web && npm install
```

2. Configure server env
```bash
cp /Users/manmeetmaggu/ClawMail/apps/server/.env.example /Users/manmeetmaggu/ClawMail/apps/server/.env
# fill GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
```

3. Run backend
```bash
cd /Users/manmeetmaggu/ClawMail/apps/server
npm run dev
```

4. Run frontend
```bash
cd /Users/manmeetmaggu/ClawMail/apps/web
npm run dev
# open http://localhost:3000
```

## Test Suites
From `apps/web`:

```bash
node ui-fake-thread-reply-check.mjs
node ui-full-email-check.mjs
node ui-extended-email-check.mjs
```

What they cover:
- Fake-thread deterministic send-in-thread behavior
- Full end-to-end UI smoke (open/reply/send/archive/scroll lock/command palette)
- Extended regression checks (drawer/scrim, `a` reply-all intent, keyboard send, unread state)

## API
Primary contract file: `api/openapi.yaml`.

Implemented backend routes are under `apps/server/src/routes` and include:
- Inbox/thread legacy routes
- Gmail OAuth/connectors/sync routes
- Mail routes for threads, drafts, send, and actions
- Policy/approval/audit/task scaffolding

## Architecture
See `docs/architecture.md` for:
- frontend and backend component boundaries
- state/data flow
- Gmail integration model
- policy/audit model
- known tradeoffs and constraints

## What’s Left
See `docs/roadmap.md` for prioritized remaining work, including:
- production auth/session model
- robust connector/account model
- richer thread fidelity and pagination
- full OpenClaw action execution loop
- reliability hardening and observability
- production deployment path
