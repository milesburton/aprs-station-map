# APRS Station Map

[![CI](https://github.com/milesburton/aprs-station-map/actions/workflows/ci.yml/badge.svg)](https://github.com/milesburton/aprs-station-map/actions/workflows/ci.yml)
[![Docker Build](https://github.com/milesburton/aprs-station-map/actions/workflows/docker-build.yml/badge.svg)](https://github.com/milesburton/aprs-station-map/actions/workflows/docker-build.yml)
[![Deploy](https://github.com/milesburton/aprs-station-map/actions/workflows/deploy.yml/badge.svg)](https://github.com/milesburton/aprs-station-map/actions/workflows/deploy.yml)

Real-time APRS station map. Operates in two modes:

| Mode | Requires | Use case |
|------|----------|----------|
| **Read-only** (APRS-IS) | Internet connection only | Cloud deployments, no hardware |
| **SDR / TNC** (KISS) | RTL-SDR dongle or TNC hardware | Home station, igating, full TX/RX |

## Quick Start

```bash
cp .env.example .env
# Edit .env with your settings
docker compose -f .appcontainer/compose.yaml up -d
```

Open http://localhost

## Modes

### Read-only mode (no hardware required)

Connect to the global APRS-IS network to receive packets — no radio hardware or licensed callsign required. Uses passcode `-1` for receive-only access.

```env
DATA_SOURCE=aprs-is
STATION_CALLSIGN=NOCALL
APRS_IS_PASSCODE=-1
APRS_IS_FILTER=r/51.5/-0.1/200
```

### SDR / TNC mode (requires hardware)

Receives packets from a local Direwolf instance via KISS TCP. Supports RTL-SDR dongles, sound cards, or any KISS-compatible TNC. Set `APRS_IS_PASSCODE` to igate (relay) received RF packets to the internet.

```env
DATA_SOURCE=kiss
STATION_CALLSIGN=M0LHA-10
AUDIO_SOURCE=rtl-sdr
APRS_IS_PASSCODE=12345
```

Generate your passcode from your base callsign (no SSID) at https://apps.magicbug.co.uk/passcode/

## Configuration

Copy `.env.example` to `.env` and set your values. **Never commit `.env`** — it contains your callsign credentials.

### Common

| Variable | Description | Default |
|----------|-------------|---------|
| `DATA_SOURCE` | `kiss` or `aprs-is` | `kiss` |
| `STATION_CALLSIGN` | Your callsign e.g. `M0LHA-10` | required |
| `STATION_LATITUDE` | Station latitude (decimal degrees) | required |
| `STATION_LONGITUDE` | Station longitude (decimal degrees) | required |

### KISS / Direwolf mode (`DATA_SOURCE=kiss`)

| Variable | Description | Default |
|----------|-------------|---------|
| `AUDIO_SOURCE` | `rtl-sdr`, `soundcard`, or `null` | `rtl-sdr` |
| `RTL_FREQ` | RTL-SDR frequency | `144.8M` |
| `RTL_GAIN` | RTL-SDR gain (dB) — start at 25–30 and adjust | `30` |
| `RTL_PPM` | RTL-SDR PPM frequency correction | `0` |
| `APRS_IS_SERVER` | APRS-IS server for igating | `rotate.aprs2.net` |
| `APRS_IS_PORT` | APRS-IS server port | `14580` |
| `APRS_IS_PASSCODE` | Your passcode — leave empty to disable igating | _(disabled)_ |

### APRS-IS mode (`DATA_SOURCE=aprs-is`)

| Variable | Description | Default |
|----------|-------------|---------|
| `APRS_IS_SERVER` | APRS-IS server | `rotate.aprs2.net` |
| `APRS_IS_PORT` | APRS-IS server port | `14580` |
| `APRS_IS_PASSCODE` | `-1` for read-only, or your passcode to authenticate | `-1` |
| `APRS_IS_FILTER` | Server-side filter e.g. `r/LAT/LON/KM` | _(all packets)_ |

## Fly.io Deployment

The app deploys to Fly.io automatically on push to `main` (after tests pass). Read-only mode requires no licensed callsign.

### First-time setup

```bash
flyctl auth login
flyctl apps create aprs-station-map
flyctl volumes create aprs_data --size 1 --region lhr
```

### Set secrets

```bash
# Read-only mode (no callsign needed)
flyctl secrets set \
  DATA_SOURCE=aprs-is \
  STATION_CALLSIGN=NOCALL \
  APRS_IS_PASSCODE=-1 \
  APRS_IS_FILTER="r/51.5/-0.1/200"

# Authenticated mode (licensed callsign)
flyctl secrets set \
  DATA_SOURCE=aprs-is \
  STATION_CALLSIGN=M0LHA \
  APRS_IS_PASSCODE=<your-passcode> \
  STATION_LATITUDE=<lat> \
  STATION_LONGITUDE=<lon>
```

### GitHub Actions deploy

Add `FLY_API_TOKEN` as a repository secret (generate with `flyctl tokens create deploy`). Pushes to `main` will deploy automatically after tests pass.

## Development

Open in VS Code with the Dev Containers extension — fish shell, flyctl, and all tooling are pre-installed.

```bash
npm run validate    # lint + typecheck + tests
npm run dev:all     # frontend + backend dev servers
```

## Docker

```bash
docker compose -f .appcontainer/compose.yaml up -d
docker compose -f .appcontainer/compose.yaml build --no-cache && docker compose -f .appcontainer/compose.yaml up -d
docker compose -f .appcontainer/compose.yaml logs -f
docker compose -f .appcontainer/compose.yaml down
```

## Data Persistence

Stations and packet history are stored in a SQLite database inside the `aprs-data` Docker volume (or `/app/data` on Fly.io). Data survives container restarts.

History is retained for **7 days** and cleaned up automatically overnight.

To wipe all data and start fresh (e.g. after changing location):

```bash
docker compose -f .appcontainer/compose.yaml down
docker volume rm aprs-data
docker compose -f .appcontainer/compose.yaml up -d
```

---

MIT Licence
