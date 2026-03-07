# ClawMail

ClawMail is building an **executive assistant for everyone**: a clean, polished mail UI in front, with an OpenClaw-powered backend agent that helps people operate at superhuman speed.

## Vision
Email is where work happens, but most inbox tools still make people do everything manually. ClawMail combines:

- **A focused, keyboard-first inbox experience** for fast triage and action.
- **An AI agent backend (OpenClaw)** for planning, execution, and policy-aware automation.
- **A human-in-the-loop control model** so users stay in charge while moving faster.

Our goal is simple: **make everyone superhuman in email workflows**.

## What Exists Today
- Functional inbox client shell (list, open thread, reply dock, compose, archive/read/snooze actions)
- Gmail OAuth + sync integration
- API/server scaffolding for OpenClaw orchestration and policy/audit pipeline
- Playwright smoke suites for core UI interactions

## Product Experience
- Inbox-first, keyboard-driven workflow:
  - `j/k` navigate, `Enter/o` open, `u` back, `r/a` reply, `e` archive, `/` search
  - `Cmd/Ctrl+K` command palette
  - hierarchical `Esc` behavior
- Single-center thread workspace with bottom reply dock
- Right-side `Claw Agent` panel
- Gmail connect/sync entry points
- Draft/send flows (with graceful fallback behavior)

## Architecture at a Glance
- **Frontend (`apps/web`)**: Next.js + React + TypeScript
- **Backend (`apps/server`)**: Express + TypeScript + Zod
- **Contract (`api/openapi.yaml`)**: OpenAPI-style API definition
- **Docs (`docs/`)**: setup, architecture, roadmap, deployment runbooks

See `docs/architecture.md` for full system boundaries and runtime flow.

## Repository Structure
- `apps/web` — Next.js mail client
- `apps/server` — API server and integration/orchestration layer
- `api/openapi.yaml` — API contract
- `docs/setup.md` — local setup and operations
- `docs/architecture.md` — architecture and runtime flow
- `docs/roadmap.md` — prioritized path to production

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

## Testing
From `apps/web`:

```bash
node ui-fake-thread-reply-check.mjs
node ui-full-email-check.mjs
node ui-extended-email-check.mjs
```

Coverage includes:
- deterministic fake-thread send-in-thread behavior
- end-to-end UI smoke checks (open/reply/send/archive/scroll lock/command palette)
- regression checks (drawer/scrim, reply-all intent, keyboard send, unread state)

## API & Backend Surface
Primary contract: `api/openapi.yaml`.

Implemented backend route groups in `apps/server/src/routes` include:
- inbox/thread legacy routes
- Gmail OAuth/connectors/sync routes
- mail routes for threads, drafts, send, and actions
- policy/approval/audit/task scaffolding

## Roadmap
See `docs/roadmap.md` for what remains to ship production-grade ClawMail, including:
- production auth/session model
- robust multi-account connector model
- richer thread fidelity and pagination
- full OpenClaw action execution loop
- reliability hardening and observability
- production deployment path
