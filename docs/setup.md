# Setup Guide

## 1. Prerequisites
- Node.js 20+
- npm 10+
- macOS/Linux shell
- Google Cloud OAuth client (for Gmail integration)

## 2. Install

```bash
cd /Users/manmeetmaggu/ClawMail/apps/server && npm install
cd /Users/manmeetmaggu/ClawMail/apps/web && npm install
```

## 3. Server Environment

Create env file:

```bash
cp /Users/manmeetmaggu/ClawMail/apps/server/.env.example /Users/manmeetmaggu/ClawMail/apps/server/.env
```

Required values:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional:
- `GOOGLE_REDIRECT_URI` (defaults to `http://localhost:8080/v1/auth/google/callback`)
- `HOST` (default `127.0.0.1`)
- `PORT` (default `8080`)
- `CORS_ORIGIN` (optional comma-separated allowlist)

## 4. Run Locally

### Backend
```bash
cd /Users/manmeetmaggu/ClawMail/apps/server
npm run dev
```

### Frontend
```bash
cd /Users/manmeetmaggu/ClawMail/apps/web
npm run dev
```

Open `http://localhost:3000`.

## 5. Gmail OAuth Flow
1. Start server.
2. In UI, click `Sync` (it opens OAuth when disconnected).
3. Complete Google consent.
4. Return to app and click `Sync`.

Notes:
- OAuth token persists at:
  - `/Users/manmeetmaggu/ClawMail/apps/server/.data/gmail-token.json`
- If permissions are missing, reconnect with updated consent scopes.

## 6. Build + Production-like Run

```bash
cd /Users/manmeetmaggu/ClawMail/apps/server && npm run build
cd /Users/manmeetmaggu/ClawMail/apps/web && npm run build

cd /Users/manmeetmaggu/ClawMail/apps/server && npm run start
cd /Users/manmeetmaggu/ClawMail/apps/web && npm run start
```

## 7. UI Regression Tests

Run from `apps/web`:

```bash
node ui-fake-thread-reply-check.mjs
node ui-full-email-check.mjs
node ui-extended-email-check.mjs
```

Recommended order:
1. fake-thread (deterministic send-in-thread)
2. full smoke
3. extended regressions

## 8. Troubleshooting

### Port in use
```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:8080 -sTCP:LISTEN
kill <pid>
```

### OAuth 403 / unverified app
- Ensure your Google account is in OAuth test users.
- Ensure correct redirect URI in Google Console.
- Reconnect after adding scopes.

### Frontend chunk errors in dev/start
- Restart frontend process.
- If error includes `Cannot find module './xxx.js'`, clear Next cache:
```bash
cd /Users/manmeetmaggu/ClawMail/apps/web
rm -rf .next
```
- Rebuild if needed:
```bash
cd /Users/manmeetmaggu/ClawMail/apps/web
npm run build
npm run start
```

## 9. Private Remote Access (Phone + Laptop)
- Deployment/security plan:
  - `/Users/manmeetmaggu/ClawMail/docs/private-access-deployment.md`
- Reverse proxy template:
  - `/Users/manmeetmaggu/ClawMail/deploy/Caddyfile.tailnet.example`
- Systemd templates:
  - `/Users/manmeetmaggu/ClawMail/deploy/systemd/clawmail-server.service`
  - `/Users/manmeetmaggu/ClawMail/deploy/systemd/clawmail-web.service`

### Push issues
- Repo is configured to push via SSH:
  - `git@github.com:manmeet/ClawMail.git`
- Confirm auth:
```bash
ssh -T git@github.com
```
