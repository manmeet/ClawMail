# OpenClaw Host Setup Runbook (ClawMail)

Use this exact prompt with your OpenClaw agent on the always-on machine.

```text
You are setting up ClawMail on this machine as the always-on host.

Goal:
- Run ClawMail web + server on this machine continuously.
- Server must stay private on localhost.
- Access app remotely only via Tailscale + HTTPS.
- Pull code from Git repo and run with systemd.

Stop on first failing step and report exact error + command output.

========================================
INPUTS (fill these first)
========================================
REPO_URL=<git repo url>
REPO_BRANCH=<branch to deploy, e.g. main>
TAILNET_HOST=<tailscale hostname, e.g. clawmail-host.tailnet-name.ts.net>
GOOGLE_CLIENT_ID=<value>
GOOGLE_CLIENT_SECRET=<value>

# OAuth callback we will use:
# https://$TAILNET_HOST/api/v1/auth/google/callback

========================================
1) BASE SYSTEM PREP
========================================
Run:

set -euo pipefail

sudo apt update
sudo apt install -y git curl caddy ufw ca-certificates gnupg jq

# Node 20
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v20'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

node -v
npm -v

========================================
2) INSTALL + CONNECT TAILSCALE
========================================
Run:

if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

echo "Run tailscale auth if needed:"
sudo tailscale up
tailscale status

# Confirm this machine has the expected tailnet name
tailscale status --json | jq -r '.Self.DNSName'

========================================
3) DEPLOY CODE TO /opt/clawmail
========================================
Run:

sudo mkdir -p /opt/clawmail
sudo chown -R $USER:$USER /opt/clawmail

if [ -d /opt/clawmail/.git ]; then
  cd /opt/clawmail
  git fetch --all
  git checkout "$REPO_BRANCH"
  git pull --ff-only origin "$REPO_BRANCH"
else
  git clone "$REPO_URL" /opt/clawmail
  cd /opt/clawmail
  git checkout "$REPO_BRANCH"
fi

# Install deps
cd /opt/clawmail/apps/server && npm install
cd /opt/clawmail/apps/web && npm install

========================================
4) CONFIGURE SERVER ENV
========================================
Run:

cd /opt/clawmail/apps/server
cp -n .env.example .env

# Replace .env with secure values
cat > /opt/clawmail/apps/server/.env <<EOF
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://$TAILNET_HOST/api/v1/auth/google/callback
HOST=127.0.0.1
PORT=8080
CORS_ORIGIN=https://$TAILNET_HOST
EOF

# Ensure token dir exists
mkdir -p /opt/clawmail/apps/server/.data

========================================
5) BUILD APPS
========================================
Run:

cd /opt/clawmail/apps/server && npm run build
cd /opt/clawmail/apps/web && npm run build

========================================
6) CONFIGURE CADDY (HTTPS + REVERSE PROXY)
========================================
Run:

sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$TAILNET_HOST {
  encode gzip zstd

  @api path /api/*
  handle @api {
    uri strip_prefix /api
    reverse_proxy 127.0.0.1:8080
  }

  handle {
    reverse_proxy 127.0.0.1:3000
  }

  header {
    X-Frame-Options "SAMEORIGIN"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "same-origin"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
  }
}
EOF

sudo systemctl enable caddy
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager

========================================
7) CREATE SYSTEM USER + SYSTEMD SERVICES
========================================
Run:

sudo useradd -r -s /usr/sbin/nologin clawmail || true
sudo chown -R clawmail:clawmail /opt/clawmail

sudo tee /etc/systemd/system/clawmail-server.service >/dev/null <<'EOF'
[Unit]
Description=ClawMail API Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/clawmail/apps/server
Environment=NODE_ENV=production
EnvironmentFile=/opt/clawmail/apps/server/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
User=clawmail
Group=clawmail

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/clawmail-web.service >/dev/null <<'EOF'
[Unit]
Description=ClawMail Web App
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/clawmail/apps/web
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
User=clawmail
Group=clawmail

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now clawmail-server
sudo systemctl enable --now clawmail-web

sudo systemctl status clawmail-server --no-pager
sudo systemctl status clawmail-web --no-pager

========================================
8) FIREWALL LOCKDOWN
========================================
Run:

sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH if needed
sudo ufw allow 22/tcp

# Allow HTTPS only over tailscale interface
sudo ufw allow in on tailscale0 to any port 443 proto tcp

sudo ufw --force enable
sudo ufw status verbose

========================================
9) HEALTH CHECKS
========================================
Run:

# Local private services
curl -sS http://127.0.0.1:8080/health
curl -sS http://127.0.0.1:3000 | head -n 2

# Through reverse proxy route
curl -sS https://$TAILNET_HOST/api/health
curl -I https://$TAILNET_HOST

# Ports should not listen publicly except 443
sudo ss -ltnp | grep -E ':443|:3000|:8080' || true

# Expect:
# - 8080 bound to 127.0.0.1
# - 3000 bound locally
# - 443 available via Caddy

========================================
10) OAUTH FINALIZATION (MANUAL)
========================================
In Google Cloud Console:
- Authorized redirect URI must include:
  https://$TAILNET_HOST/api/v1/auth/google/callback

If app is in Testing mode:
- Add your Gmail accounts to OAuth Test Users.

Then in ClawMail UI:
- Open https://$TAILNET_HOST
- Click Sync, complete OAuth, click Sync again.

========================================
11) REPORT OUTPUT
========================================
Return:
1) tailscale DNS name
2) systemd statuses (server/web/caddy)
3) curl health outputs
4) ss listener outputs
5) any errors and exact remediation done
```
