# ClawMail Private Access Deployment Plan

## Goal
Run `clawmail-server` + OpenClaw continuously on one host, and access ClawMail web from approved personal devices only (phone + laptop), with strong denial-by-default controls.

## Security Model (two gates)
1. Network gate: private overlay network only (Tailscale)
- No public ingress.
- Only approved Tailscale identities can route to the host.

2. App gate: authenticated user session
- Even approved devices must sign in.
- Session cookie required for API access.

This prevents accidental internet exposure and protects against approved-device sharing/compromise.

## Target Architecture
- Always-on host machine:
  - `clawmail-server` on `127.0.0.1:8080`
  - `clawmail-web` on `127.0.0.1:3000` (or built static app behind proxy)
  - Reverse proxy (`Caddy`) on `0.0.0.0:443` but reachable only via Tailscale IP.
- Devices:
  - Phone + laptop run Tailscale and connect via tailnet DNS (MagicDNS), e.g. `clawmail-host.tailnet-name.ts.net`.
- Routing:
  - `https://clawmail-host.tailnet-name.ts.net/` -> web
  - `https://clawmail-host.tailnet-name.ts.net/api/*` -> server

## Phase Plan

### Phase 1: Network isolation (required first)
1. Install Tailscale on host + approved devices.
2. Enable MagicDNS.
3. In router/firewall, do not forward any ports to host.
4. Host firewall:
   - Allow inbound 22 only if needed.
   - Allow inbound 443 only from Tailscale interface (`tailscale0`) or tailnet CIDR.
   - Deny all other inbound.
5. Make server/web local-only:
   - server binds to `127.0.0.1:8080`
   - web binds to `127.0.0.1:3000`

Acceptance criteria:
- App works from approved tailnet device.
- App is unreachable from non-tailnet network.

### Phase 2: Reverse proxy + split web/server
1. Add Caddy config:
- Terminate HTTPS (Tailscale cert integration).
- Route `/api/*` to `127.0.0.1:8080`.
- Route `/` to `127.0.0.1:3000`.
- Set `X-Forwarded-*` headers.

2. Update web API base URL:
- Web uses relative `/api` path (same origin), not hardcoded `localhost:8080`.

3. Update server CORS:
- Restrict to single trusted origin (`https://clawmail-host.tailnet-name.ts.net`).

Acceptance criteria:
- Web and API accessible through one private HTTPS URL.
- Direct raw API access from browser origin mismatch is blocked.

### Phase 3: App authentication (session-based)
1. Add auth module in server:
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

2. Use secure HTTP-only cookies:
- `Secure`, `HttpOnly`, `SameSite=Strict`, short TTL + refresh.

3. Protect routes with middleware:
- Require session for all `/v1/*` except health + OAuth callback/start if needed.

4. Suggested auth options:
- Option A (fast): admin password in env + TOTP.
- Option B (preferred): passkeys/WebAuthn.

Acceptance criteria:
- Unauthenticated API requests get `401`.
- Authenticated sessions survive page refresh and can be revoked.

### Phase 4: Device allowlist and visibility
1. Track sessions/devices in server store (`.data/sessions.json` initially):
- session id, user id, device label, user-agent, first seen, last seen, source IP.

2. Add endpoints:
- `GET /v1/security/devices`
- `POST /v1/security/devices/:id/revoke`

3. Add UI panel:
- Show active devices/sessions.
- Revoke a device/session with one click.

4. Optional strict device claim:
- First login requires naming device.
- New device requires explicit approval.

Acceptance criteria:
- You can see every active device/session.
- Revoking immediately invalidates API access.

### Phase 5: Hardening
1. Rate limiting on auth + sensitive routes.
2. CSRF protection for cookie-auth state-changing routes.
3. Request/audit log for auth failures and denied requests.
4. Secret hygiene:
- move auth secret, OAuth secrets to env/secret manager.
5. Backup:
- include `.data` (gmail token + sessions) with encrypted backups.

## Concrete Repo Changes

### Server (`apps/server`)
- `src/index.ts`
  - trust proxy + strict CORS origin from env
  - register auth/session middleware
- Add new files:
  - `src/middleware/require-auth.ts`
  - `src/services/session-store.ts`
  - `src/routes/session-auth.ts`
  - `src/routes/security-devices.ts`
- Add deps:
  - `cookie-parser`
  - `express-rate-limit`
  - `csrf` (or double-submit pattern)

### Web (`apps/web`)
- `src/lib/api.ts`
  - default API base to same-origin `/api` in deployed mode
- Add auth views/components
  - login form + session bootstrap on app load
  - unauthorized state handling
- Add security page
  - active sessions/devices + revoke

### Ops
- New file: `deploy/Caddyfile`
- New file: `deploy/systemd/clawmail-server.service`
- New file: `deploy/systemd/clawmail-web.service`
- New file: `deploy/systemd/caddy.service` (if not managed by package)

## Environment Variables (planned)
- `PORT=8080`
- `HOST=127.0.0.1`
- `CORS_ORIGIN=https://clawmail-host.tailnet-name.ts.net`
- `SESSION_SECRET=<long-random>`
- `SESSION_TTL_MINUTES=1440`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_REDIRECT_URI=https://clawmail-host.tailnet-name.ts.net/api/v1/auth/google/callback`

## Rollout Order (safe)
1. Ship Phase 1 + 2 first (network + proxy split).
2. Verify private reachability from phone/laptop.
3. Ship Phase 3 auth.
4. Ship Phase 4 device visibility/revoke.
5. Ship hardening.

## Immediate Next Step
Implement Phase 1 + Phase 2 in code/config first, then validate from one laptop and one phone before adding app auth.
