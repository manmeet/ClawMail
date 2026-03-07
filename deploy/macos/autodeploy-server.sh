#!/bin/zsh
set -euo pipefail

REPO_DIR="/Users/trexoagent/Clawmail/app"
BRANCH="main"
LOG_FILE="$REPO_DIR/apps/server/.logs/autodeploy.log"
LOCK_DIR="/tmp/com.clawmail.autodeploy.lock"

mkdir -p "$(dirname "$LOG_FILE")"
exec >>"$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] autodeploy tick"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] another deploy run in progress; skipping"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT

cd "$REPO_DIR"

# Keep local checkout current with origin/main; deploy only when commit changed.
git fetch --prune origin "$BRANCH"
LOCAL_SHA="$(git rev-parse "$BRANCH")"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] no changes ($LOCAL_SHA)"
  exit 0
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] tracked local changes detected; refusing auto-deploy"
  exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] updating $LOCAL_SHA -> $REMOTE_SHA"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

cd "$REPO_DIR/apps/server"
npm install --no-audit --no-fund
npm run build

launchctl kickstart -k "gui/$(id -u)/com.clawmail.server"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] deploy complete at $(git -C "$REPO_DIR" rev-parse --short HEAD)"
