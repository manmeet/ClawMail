# ClawMail Server

Express scaffolding for OpenClaw orchestration + policy gate + audit log.

## Core runtime rule
- LLM proposes actions.
- Policy engine approves/denies/requires approval.
- High-risk actions require approval token.

## Endpoints
- `GET /health`
- `GET /v1/inbox?view=inbox|priority|...`
- `GET /v1/threads/:threadId`
- `POST /v1/threads/:threadId/agent/actions`
- `POST /v1/agent/chat`
- `POST /v1/drafts`
- `POST /v1/drafts/:draftId/approve-send`
- `GET|POST /v1/tasks`
- `POST /v1/approvals`
- `GET /v1/audit/events`
- `GET /v1/connectors`
- `GET /v1/auth/google/start`
- `GET /v1/auth/google/callback?code=...`
- `GET /v1/auth/google/status`
- `POST /v1/auth/google/disconnect`
- `POST /v1/sync/gmail?maxResults=25`

## Gmail OAuth setup
Set these env vars before running the server:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (optional, defaults to `http://localhost:8080/v1/auth/google/callback`)

Persistent setup:

1. Copy `/Users/manmeetmaggu/ClawMail/apps/server/.env.example` to `/Users/manmeetmaggu/ClawMail/apps/server/.env`.
2. Fill in your real Google values once.
3. Start server normally with `npm run dev` (dotenv auto-loads `.env`).

Quick flow:

1. Call `GET /v1/auth/google/start`.
2. Open returned `authUrl` in browser and complete consent.
3. Google redirects to `/v1/auth/google/callback`.
4. Call `POST /v1/sync/gmail` to ingest inbox threads into ClawMail.

Token storage:

- OAuth token is persisted locally in `/Users/manmeetmaggu/ClawMail/apps/server/.data/gmail-token.json`.

## Agent bridge setup (IronClaw/OpenClaw)

`POST /v1/agent/chat` shells out to your local agent CLI.

Optional env vars:
- `AGENT_CLI_BIN` (default: `ironclaw`)
- `AGENT_ID` (default: `main`)
- `AGENT_TIMEOUT_SECONDS` (default: `120`)
