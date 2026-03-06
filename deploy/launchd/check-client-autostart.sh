#!/usr/bin/env bash
set -euo pipefail

AGENT_ID="com.clawmail.web"
PLIST_PATH="${HOME}/Library/LaunchAgents/${AGENT_ID}.plist"

if [[ -f "${PLIST_PATH}" ]]; then
  echo "Plist: ${PLIST_PATH}"
else
  echo "Plist missing: ${PLIST_PATH}"
fi

launchctl print "gui/$(id -u)/${AGENT_ID}" 2>/dev/null | sed -n '1,60p' || echo "Agent not loaded"
