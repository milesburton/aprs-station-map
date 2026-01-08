#!/bin/bash

# Auto-update script for APRS Station Map Docker container
# This script periodically checks for updates and rebuilds the container if changes are detected

set -e

REPO_DIR="${REPO_DIR:-/home/miles/aprs-station-map}"
CHECK_INTERVAL="${CHECK_INTERVAL:-3600}" # Default: 1 hour
BRANCH="${BRANCH:-main}"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

cd "$REPO_DIR" || exit 1

log "Starting auto-update monitor (checking every ${CHECK_INTERVAL}s)"

while true; do
  log "Checking for updates..."

  # Fetch latest changes
  git fetch origin "$BRANCH" 2>&1 | while read -r line; do log "$line"; done

  # Check if local is behind remote
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse "origin/$BRANCH")

  if [ "$LOCAL" != "$REMOTE" ]; then
    log "Updates found! Local: ${LOCAL:0:7}, Remote: ${REMOTE:0:7}"
    log "Pulling latest changes..."

    git pull origin "$BRANCH" 2>&1 | while read -r line; do log "$line"; done

    log "Rebuilding and restarting container..."
    docker compose -f .appcontainer/compose.yaml up -d --build 2>&1 | while read -r line; do log "$line"; done

    log "Container updated successfully!"
  else
    log "Already up to date (${LOCAL:0:7})"
  fi

  log "Sleeping for ${CHECK_INTERVAL}s..."
  sleep "$CHECK_INTERVAL"
done
