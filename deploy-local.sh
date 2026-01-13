#!/bin/bash

# =============================================================================
# APRS Station Map - Local Deployment Script
# =============================================================================
#
# This script deploys the application to a target server for testing.
# It's designed to work independently of the optional 'deploy' submodule.
#
# Usage:
#   ./deploy-local.sh              # Deploy to default target from .env
#   ./deploy-local.sh --target pi  # Deploy to Pi (production)
#   ./deploy-local.sh --target lab # Deploy to home lab (testing)
#
# Configuration:
#   Copy .env.example to .env and set:
#   - DEPLOY_TARGET: SSH target (user@hostname)
#   - DEPLOY_DIR: Remote directory name
#   - DEPLOY_PORT: Port for health check
#
# Note: The 'deploy' submodule (home-lab-deploy) is private and optional.
#       This script works without it.
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Determine script and project directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
cd "$PROJECT_DIR"

# Parse arguments
TARGET_PRESET=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET_PRESET="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [--target pi|lab]"
            echo ""
            echo "Options:"
            echo "  --target pi   Deploy to production Pi (uses DEPLOY_TARGET_PI from .env)"
            echo "  --target lab  Deploy to home lab test server (uses DEPLOY_TARGET_LAB from .env)"
            echo ""
            echo "Without --target, uses DEPLOY_TARGET from .env"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if deploy submodule is available (optional)
if [ -d "deploy" ] && [ -f "deploy/deploy.sh" ]; then
    log "Deploy submodule available (home-lab-deploy)"
    SUBMODULE_AVAILABLE=true
else
    warn "Deploy submodule not available (private repo: home-lab-deploy)"
    warn "Using standalone deployment mode"
    SUBMODULE_AVAILABLE=false
fi

# Load environment variables from .env file
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    warn ".env file not found"
    if [ -f .env.example ]; then
        warn "Copy .env.example to .env and configure your deployment settings"
    fi
fi

# Handle target presets (use environment variables from .env)
case "$TARGET_PRESET" in
    pi|prod|production)
        if [ -z "$DEPLOY_TARGET_PI" ]; then
            error "DEPLOY_TARGET_PI not set in .env"
            exit 1
        fi
        DEPLOY_TARGET="$DEPLOY_TARGET_PI"
        DEPLOY_DIR="${DEPLOY_DIR_PI:-aprs-station-map}"
        DEPLOY_PORT="${DEPLOY_PORT_PI:-80}"
        log "Using production Pi target"
        ;;
    lab|test)
        if [ -z "$DEPLOY_TARGET_LAB" ]; then
            error "DEPLOY_TARGET_LAB not set in .env"
            exit 1
        fi
        DEPLOY_TARGET="$DEPLOY_TARGET_LAB"
        DEPLOY_DIR="${DEPLOY_DIR_LAB:-aprs-station-map}"
        DEPLOY_PORT="${DEPLOY_PORT_LAB:-8001}"
        log "Using home lab test target"
        ;;
    "")
        # Use .env values
        ;;
    *)
        error "Unknown target preset: $TARGET_PRESET"
        error "Valid presets: pi, lab"
        exit 1
        ;;
esac

# Validate required variables
if [ -z "$DEPLOY_TARGET" ]; then
    error "DEPLOY_TARGET not set"
    error "Either use --target preset or set DEPLOY_TARGET in .env"
    exit 1
fi

if [ -z "$DEPLOY_DIR" ]; then
    DEPLOY_DIR="aprs-station-map"
    warn "DEPLOY_DIR not set, using default: $DEPLOY_DIR"
fi

# Use environment variables with defaults
TARGET="${DEPLOY_TARGET}"
APP_NAME="${APP_NAME:-$(basename "$PROJECT_DIR")}"
REMOTE_DEPLOY_DIR="${DEPLOY_DIR}"
DEPLOY_PORT="${DEPLOY_PORT:-80}"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_rsa}"

log "Deploying ${APP_NAME} to ${TARGET}..."
log "Remote directory: ~/${REMOTE_DEPLOY_DIR}"
log "Health check port: ${DEPLOY_PORT}"

# Get git commit hash and version
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
PKG_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
log "Git: ${GIT_BRANCH} @ ${GIT_COMMIT}"
log "Version: ${PKG_VERSION}"

# Create version.json in public/ so Vite copies it to dist/
cat > public/version.json << EOF
{
  "version": "${PKG_VERSION}",
  "commit": "${GIT_COMMIT}",
  "branch": "${GIT_BRANCH}",
  "buildTime": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"
}
EOF

# Build locally
log "Building application..."
if ! npm run build; then
    error "Build failed!"
    exit 1
fi

# Create deployment archive - INCLUDE .appcontainer for Docker builds
log "Creating deployment package..."
tar czf /tmp/${APP_NAME}.tar.gz \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.bun' \
    --exclude='.devcontainer' \
    --exclude='.claude' \
    --exclude='*.log' \
    --exclude='coverage' \
    --exclude='.nyc_output' \
    --exclude='deploy' \
    --exclude='test-results' \
    --exclude='playwright-report' \
    --exclude='e2e/__snapshots__' \
    .

PACKAGE_SIZE=$(du -h /tmp/${APP_NAME}.tar.gz | cut -f1)
log "Package size: ${PACKAGE_SIZE}"

# Transfer files to server
log "Transferring files to ${TARGET}..."
ssh -i "${SSH_KEY}" "${TARGET}" "mkdir -p ~/${REMOTE_DEPLOY_DIR}"
scp -i "${SSH_KEY}" /tmp/${APP_NAME}.tar.gz "${TARGET}:~/${REMOTE_DEPLOY_DIR}/"

# Deploy on server
log "Deploying with Docker (commit: ${GIT_COMMIT})..."

# Use .appcontainer/compose.yaml for the Pi (production) setup
SSH_DEPLOY_CMD="cd ~/${REMOTE_DEPLOY_DIR} && \
    tar xzf ${APP_NAME}.tar.gz && \
    rm ${APP_NAME}.tar.gz && \
    (docker compose -f .appcontainer/compose.yaml down 2>/dev/null || \
     docker compose down 2>/dev/null || \
     docker-compose down 2>/dev/null || true) && \
    (docker compose -f .appcontainer/compose.yaml up -d --build 2>/dev/null || \
     docker compose up -d --build 2>/dev/null || \
     docker-compose up -d --build) && \
    (docker compose -f .appcontainer/compose.yaml ps 2>/dev/null || \
     docker compose ps 2>/dev/null || \
     docker-compose ps)"

ssh -i "${SSH_KEY}" "${TARGET}" "${SSH_DEPLOY_CMD}"

# Cleanup
rm /tmp/${APP_NAME}.tar.gz

log "Deployment complete!"

# Health check
REMOTE_HOST="${TARGET#*@}"
log "Running health check on http://${REMOTE_HOST}:${DEPLOY_PORT}..."
sleep 3

for i in {1..10}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${REMOTE_HOST}:${DEPLOY_PORT}/" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        log "Health check passed (HTTP $HTTP_CODE)"
        echo ""
        log "Application deployed successfully!"
        log "URL: http://${REMOTE_HOST}:${DEPLOY_PORT}/"
        exit 0
    fi
    warn "Attempt $i/10: HTTP $HTTP_CODE - waiting..."
    sleep 3
done

error "Health check failed after 10 attempts (last status: HTTP $HTTP_CODE)"
error "Check logs with: ssh ${TARGET} 'cd ~/${REMOTE_DEPLOY_DIR} && docker compose logs'"
exit 1
