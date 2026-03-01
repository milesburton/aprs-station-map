#!/bin/bash

set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/miles/aprs-station-map}"
CHECK_INTERVAL="${CHECK_INTERVAL:-3600}" # Default: 1 hour
BRANCH="${BRANCH:-main}"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

run_logged() {
  "$@" 2>&1 | while read -r line; do
    log "$line"
  done
}

cd "$REPO_DIR" || exit 1

log "Starting auto-update monitor (checking every ${CHECK_INTERVAL}s)"

while true; do
  log "Checking for updates..."

  # Fetch latest changes
  run_logged git fetch origin "$BRANCH"

  # Check if local is behind remote
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/$BRANCH")

  if [ "$LOCAL" != "$REMOTE" ]; then
    log "Updates found! Local: ${LOCAL:0:7}, Remote: ${REMOTE:0:7}"
    log "Pulling latest changes..."

    if [[ -n "$(git status --porcelain)" ]]; then
      log "Working tree is dirty; skipping update to avoid merge conflicts"
      log "Sleeping for ${CHECK_INTERVAL}s..."
      sleep "$CHECK_INTERVAL"
      continue
    fi

    run_logged git pull origin "$BRANCH"

    log "Rebuilding and restarting container..."
    if run_logged docker compose -f .appcontainer/compose.yaml up -d --build; then
      log "Container updated successfully!"
    else
      log "Container update failed"
    fi
  else
    log "Already up to date (${LOCAL:0:7})"
  fi

  log "Sleeping for ${CHECK_INTERVAL}s..."
  sleep "$CHECK_INTERVAL"
done
