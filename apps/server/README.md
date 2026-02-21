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
- `POST /v1/drafts`
- `POST /v1/drafts/:draftId/approve-send`
- `GET|POST /v1/tasks`
- `POST /v1/approvals`
- `GET /v1/audit/events`
