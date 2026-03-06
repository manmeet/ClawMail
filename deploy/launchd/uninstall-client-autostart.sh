#!/usr/bin/env bash
set -euo pipefail

AGENT_ID="com.clawmail.web"
PLIST_PATH="${HOME}/Library/LaunchAgents/${AGENT_ID}.plist"

launchctl bootout "gui/$(id -u)" "${PLIST_PATH}" >/dev/null 2>&1 || true
launchctl disable "gui/$(id -u)/${AGENT_ID}" >/dev/null 2>&1 || true
rm -f "${PLIST_PATH}"

echo "Uninstalled ${AGENT_ID}"
