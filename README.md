# APRS Station Map

[![CI](https://github.com/milesburton/aprs-station-map/actions/workflows/ci.yml/badge.svg)](https://github.com/milesburton/aprs-station-map/actions/workflows/ci.yml)
[![Docker Build](https://github.com/milesburton/aprs-station-map/actions/workflows/docker-build.yml/badge.svg)](https://github.com/milesburton/aprs-station-map/actions/workflows/docker-build.yml)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](./coverage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)

```
   📡 APRS Station Map
   ═══════════════════

        *           .    *       .
     .      🛰️    .        *
           .     *    .        *
      *        .           .
         🏠 ← Your Station
        /|\
       / | \    ← Coverage rings (50-500km)
      /  |  \
   ──┴──┴──┴──
```

Web-based APRS station map with real-time updates via WebSocket. Receives APRS packets from SDR software (via KISS protocol) and stores station data in SQLite.

## Features

| Feature | Description |
|---------|-------------|
| 📍 Live Map | Interactive Leaflet map with station markers |
| 🔍 Filtering | Search by callsign, filter by symbol, distance |
| 📊 Statistics | Station count, average distance, furthest contact |
| 🔗 URL State | Shareable links preserve filters and map position |
| 🌙 Dark Theme | Easy on the eyes during those late-night DX sessions |
| 📱 Responsive | Works on desktop and mobile |

## Prerequisites

- Docker and Docker Compose v2 installed

That's it. No faffing about with Node versions or npm dependencies.

### Installing Docker (Raspberry Pi / Debian / Ubuntu)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in (or reboot) for group changes to take effect. Verify with:

```bash
docker compose version
```

## Quick Start

```bash
git clone https://github.com/milesburton/aprs-station-map.git
cd aprs-station-map
docker compose -f .appcontainer/compose.yaml up -d
```

Open `http://localhost:3000` and watch the stations roll in.

## Running Continuously

The container runs as a daemon and restarts automatically unless you tell it to stop:

```bash
docker compose -f .appcontainer/compose.yaml up -d      # Start in background
docker compose -f .appcontainer/compose.yaml logs -f    # View live logs
docker compose -f .appcontainer/compose.yaml stop       # Stop the container
docker compose -f .appcontainer/compose.yaml down       # Stop and remove container
```

Check container health:

```bash
docker inspect --format='{{json .State.Health.Status}}' aprs-station-map
```


## Development

### Using Dev Container (Recommended)

1. Install [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
2. Open project in VS Code
3. Click "Reopen in Container"
4. Run `npm run dev`

The dev container includes all necessary build tools and is isolated from the production container.

### Using Docker Compose for Development

```bash
docker compose -f .devcontainer/compose.dev.yaml up
```

This starts a development container with hot-reload enabled and source code mounted.

### Local Development

If you prefer to run directly on your machine:

```bash
npm install
npm run dev           # Start dev server on :3000
npm test              # Run tests
npm run lint          # Check code style
npm run typecheck     # TypeScript validation
npm run build         # Production build
```


## Architecture

### Project Structure

```
.appcontainer/         # Production container configuration
├── Dockerfile         # Multi-stage production build
├── nginx.conf        # Nginx configuration
└── compose.yaml      # Production Docker Compose

.devcontainer/        # Development container configuration
├── Dockerfile        # Development environment
└── devcontainer.json # VS Code dev container config

src/
├── components/       # React components
│   ├── FilterPanel.tsx
│   ├── StationList.tsx
│   ├── StationMap.tsx
│   └── StationMarker.tsx
├── hooks/            # Custom React hooks
│   ├── useFilters.ts
│   ├── useMapState.ts
│   └── useStations.ts
├── server/           # Backend server
│   ├── index.ts      # HTTP + WebSocket server
│   ├── kiss-client.ts # KISS TNC client
│   ├── database.ts   # SQLite persistence
│   ├── aprs-parser.ts # APRS packet parser
│   └── config.ts     # Server configuration
├── services/         # Business logic
│   ├── station-filter.ts
│   └── url-state.ts
├── types/            # TypeScript definitions
├── utils/            # Utility functions
│   ├── geo.ts        # Distance, bearing calculations
│   ├── logger.ts     # Pino structured logging
│   └── time.ts       # Time formatting
└── constants.ts      # Configuration values

scripts/
├── test-container.sh  # Container validation
├── test-dockerfile.sh # Dockerfile build test
└── sanity-check.js    # Quick health check
```

### Container Architecture

**Production** ([.appcontainer/](.appcontainer/)):
- [Dockerfile](.appcontainer/Dockerfile) - Multi-stage build
- [nginx.conf](.appcontainer/nginx.conf) - Web server config
- [compose.yaml](.appcontainer/compose.yaml) - Container orchestration
- nginx serves frontend and proxies API/WebSocket
- Node.js backend with KISS TNC client
- Supervisor manages both processes

**Development** ([.devcontainer/](.devcontainer/)):
- [Dockerfile](.devcontainer/Dockerfile) - Dev environment
- [compose.dev.yaml](.devcontainer/compose.dev.yaml) - Dev orchestration
- [devcontainer.json](.devcontainer/devcontainer.json) - VS Code integration
- Hot-reload enabled
- Full development toolchain
- Isolated from production


## Data Source

The application connects to a KISS TNC server via TCP and stores station data in a SQLite database. The database is persisted in a Docker named volume (`aprs-data`) at `/app/data/stations.db`.

**Important**: Data is preserved between container rebuilds using the `aprs-data` named volume. Your station history will not be lost when updating the application.

### Configuration

Configure your TNC connection via environment variables. Create a `.env` file in the project root:

```bash
KISS_HOST=localhost          # TNC host
KISS_PORT=8001              # TNC KISS port
STATION_LATITUDE=51.5074    # Your station latitude
STATION_LONGITUDE=-0.1278   # Your station longitude
STATION_CALLSIGN=MYCALL     # Your callsign
LOG_LEVEL=info              # Log level (debug, info, warn, error)
```

Or edit [.appcontainer/compose.yaml](.appcontainer/compose.yaml) directly.

The map receives real-time updates via WebSocket when new stations are heard.

## APRS Symbol Reference

| Symbol | Meaning |
|--------|---------|
| `-` | House/QTH |
| `>` | Car |
| `k` | Truck |
| `b` | Bicycle |
| `'` | Aircraft |
| `_` | Weather station |
| `#` | Digipeater |
| `&` | Gateway |

## Tests

### Pre-Deployment Tests (Run First!)

Before building or deploying, validate your environment:

```bash
npm run test:pre-deploy
```

This validates:
- Node.js and Docker installed
- Required files present
- No personal information in code
- TypeScript configuration valid
- Dockerfile syntax correct
- Named volumes configured for data persistence

**Run this before every deployment to catch issues early!**

### Unit Tests

Tests are co-located with source files using the `*.spec.ts` naming convention.

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode (interactive)
npm run test:coverage # Coverage report (100% required)
npm run test:ui       # Visual test UI
```

**Coverage Requirements**: This project enforces 100% test coverage for all source files. All code must have corresponding tests.

### Container Tests (After Deployment)

After starting the container, validate it's working:

```bash
npm run test:container # Full container test suite
npm run sanity         # Quick backend health check
```

The container test suite validates:
- Container is running and healthy
- HTTP server (nginx) responding
- API endpoints functional
- WebSocket server accessible
- Database volume mounted
- All processes running correctly

### Recommended Test Workflow

```bash
# 1. Pre-deployment validation
npm run test:pre-deploy

# 2. Build and start
docker compose -f .appcontainer/compose.yaml up -d

# 3. Wait for startup (30 seconds)
sleep 30

# 4. Verify deployment
npm run test:container
```

## Tech Stack

- **Runtime**: Node.js 22
- **Framework**: React 19
- **Build**: Vite 6
- **Testing**: Vitest with 100% coverage
- **Map**: Leaflet + react-leaflet
- **Database**: SQLite (better-sqlite3)
- **Logging**: Pino
- **Linting**: Biome
- **Container**: Docker + nginx + supervisor


## Licence

MIT

---

*73* 📻


## Development Standards

- **Conventional Commits**: Required for all commits
- **Pre-commit Hooks**: Auto-lint, format, typecheck, and test
- **Type Safety**: Full TypeScript checking (source + tests)
- **Test Coverage**: 97% required

See [.github/CODE_QUALITY.md](.github/CODE_QUALITY.md) for details.

