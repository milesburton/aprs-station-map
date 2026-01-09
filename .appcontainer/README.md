# Application Container

This directory contains the production Docker container configuration for the APRS Station Map application.

## Files

- **[Dockerfile](Dockerfile)** - Multi-stage production build
- **[nginx.conf](nginx.conf)** - Nginx configuration for serving the frontend and proxying API requests
- **[compose.yaml](compose.yaml)** - Docker Compose configuration (symlinked from project root)

## Architecture

The production container uses a two-stage build:

### Stage 1: Builder
- Based on `node:22-slim`
- Installs all dependencies including dev dependencies
- Builds the React frontend with Vite
- Bundles the Node.js backend with esbuild

### Stage 2: Runtime
- Based on `node:22-slim`
- Installs only production dependencies
- Runs both nginx and Node.js backend via supervisor
- nginx serves the static frontend on port 80
- nginx proxies `/api` and `/ws` to the Node.js backend (port 3001)

## Running

From the project root:

```bash
# Build and run
docker compose -f .appcontainer/compose.yaml up -d

# View logs
docker compose -f .appcontainer/compose.yaml logs -f

# Stop
docker compose -f .appcontainer/compose.yaml down
```

## Rebuilding After Code Changes

Docker caches build layers aggressively. If your code changes aren't appearing in the running container, you need to rebuild without cache:

```bash
# Rebuild without cache (required after code changes)
docker compose -f .appcontainer/compose.yaml down
docker compose -f .appcontainer/compose.yaml build --no-cache
docker compose -f .appcontainer/compose.yaml up -d
```

**When to use `--no-cache`:**
- After modifying frontend code (React components, CSS, etc.)
- After modifying backend code (server, API endpoints)
- After updating dependencies in package.json
- Anytime the GUI or behavior doesn't reflect your latest changes

## Environment Variables

Configure via environment variables in `compose.yaml` or `.env` file:

- `KISS_HOST` - TNC hostname (default: host.docker.internal)
- `KISS_PORT` - KISS TCP port (default: 8001)
- `STATION_LATITUDE` - Your station latitude (required)
- `STATION_LONGITUDE` - Your station longitude (required)
- `STATION_CALLSIGN` - Your callsign (required)
- `LOG_LEVEL` - Logging level: debug, info, warn, error (default: info)

## Volumes

- `/app/data` - SQLite database persistence (mounted from Docker volume `aprs-data`)

## Health Check

The container includes a health check that queries the API endpoint:

```bash
docker inspect --format='{{json .State.Health.Status}}' aprs-station-map
```

## Ports

- Port 80 - HTTP (nginx serving frontend + API proxy)
  - `/` - React frontend
  - `/api/*` - Backend API
  - `/ws` - WebSocket connection

## Building Manually

```bash
# From project root (use --no-cache after code changes)
docker build --no-cache -f .appcontainer/Dockerfile -t aprs-station-map .

# Run
docker run -d \
  -p 3000:80 \
  -e STATION_CALLSIGN=MYCALL \
  -e STATION_LATITUDE=51.5 \
  -e STATION_LONGITUDE=-0.1 \
  -v aprs-data:/app/data \
  aprs-station-map
```
