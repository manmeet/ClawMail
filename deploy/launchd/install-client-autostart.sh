#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_DIR="${ROOT_DIR}/apps/web"
AGENT_ID="com.clawmail.web"
PLIST_PATH="${HOME}/Library/LaunchAgents/${AGENT_ID}.plist"
LOG_DIR="${HOME}/Library/Logs"
OUT_LOG="${LOG_DIR}/clawmail-web.out.log"
ERR_LOG="${LOG_DIR}/clawmail-web.err.log"

mkdir -p "${HOME}/Library/LaunchAgents" "${LOG_DIR}"

cat >"${PLIST_PATH}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${AGENT_ID}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${WEB_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>npm run start</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PORT</key>
    <string>3000</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${OUT_LOG}</string>
  <key>StandardErrorPath</key>
  <string>${ERR_LOG}</string>
</dict>
</plist>
EOF

if launchctl print "gui/$(id -u)/${AGENT_ID}" >/dev/null 2>&1; then
  launchctl bootout "gui/$(id -u)" "${PLIST_PATH}" >/dev/null 2>&1 || true
fi

launchctl bootstrap "gui/$(id -u)" "${PLIST_PATH}"
launchctl enable "gui/$(id -u)/${AGENT_ID}"
launchctl kickstart -k "gui/$(id -u)/${AGENT_ID}"

echo "Installed and started ${AGENT_ID}"
echo "Plist: ${PLIST_PATH}"
echo "Logs:  ${OUT_LOG} / ${ERR_LOG}"
