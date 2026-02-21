# ClawMail

Executive inbox webapp scaffold on top of OpenClaw.

## Workstreams
- IA + route map + component tree: `/docs/ia-route-component-tree.md`
- API contract (OpenAPI): `/api/openapi.yaml`
- Frontend shell (Next.js + keyboard-first inbox): `/apps/web`
- Backend scaffolding (Express + orchestration + audit log): `/apps/server`

## Quick start

### Frontend
```bash
cd /Users/manmeetmaggu/ClawMail/apps/web
npm install
npm run dev
```

### Backend
```bash
cd /Users/manmeetmaggu/ClawMail/apps/server
npm install
npm run dev
```

## Notes
- This scaffold is intentionally policy-first: model proposes actions, policy engine approves/denies, audit logger records everything.
- Outbound actions require explicit approval tokens.
