# APRS Station Map

[![CI](https://github.com/milesburton/aprs-station-map/actions/workflows/ci.yml/badge.svg)](https://github.com/milesburton/aprs-station-map/actions/workflows/ci.yml)
[![Docker Build](https://github.com/milesburton/aprs-station-map/actions/workflows/docker-build.yml/badge.svg)](https://github.com/milesburton/aprs-station-map/actions/workflows/docker-build.yml)

Real-time APRS station map. Works with a local RTL-SDR/Direwolf setup **or** purely over the internet via APRS-IS — no radio hardware required.

## Run

```bash
docker compose -f .appcontainer/compose.yaml up -d
```

Open http://localhost

## Data Sources

### KISS / Direwolf (default — requires SDR or TNC)

Receives packets from a local Direwolf instance via KISS TCP. Supports RTL-SDR dongles, sound cards, or any KISS-compatible TNC.

```env
DATA_SOURCE=kiss
AUDIO_SOURCE=rtl-sdr
```

### APRS-IS (no hardware required)

Connects directly to the global APRS-IS network over TCP. Ideal for VPS deployments or anyone without radio hardware. Requires a licensed amateur radio callsign and passcode.

```env
DATA_SOURCE=aprs-is
STATION_CALLSIGN=YOURCALL
APRS_IS_PASSCODE=12345
APRS_IS_FILTER=r/51.5/-0.1/200
```

Generate your passcode from your base callsign (no SSID) at https://apps.magicbug.co.uk/passcode/

## Configuration

Create a `.env` file (copy from `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `DATA_SOURCE` | `kiss` (local Direwolf) or `aprs-is` (internet) | `kiss` |
| `STATION_CALLSIGN` | Your callsign (e.g. `YOURCALL-10`) | required |
| `STATION_LATITUDE` | Station latitude (decimal degrees) | required |
| `STATION_LONGITUDE` | Station longitude (decimal degrees) | required |

**KISS / Direwolf mode only:**

| Variable | Description | Default |
|----------|-------------|---------|
| `AUDIO_SOURCE` | `rtl-sdr`, `soundcard`, or `null` | `rtl-sdr` |
| `RTL_FREQ` | RTL-SDR frequency | `144.8M` |
| `RTL_GAIN` | RTL-SDR gain (dB) — start low (~25–30) and adjust | `30` |
| `RTL_PPM` | RTL-SDR PPM frequency correction | `0` |
| `APRS_IS_SERVER` | APRS-IS server for igating | `rotate.aprs2.net` |
| `APRS_IS_PORT` | APRS-IS server port | `14580` |
| `APRS_IS_PASSCODE` | APRS-IS passcode — set to enable RF→internet relay | _(disabled)_ |

**APRS-IS mode only:**

| Variable | Description | Default |
|----------|-------------|---------|
| `APRS_IS_SERVER` | APRS-IS server | `rotate.aprs2.net` |
| `APRS_IS_PORT` | APRS-IS server port | `14580` |
| `APRS_IS_PASSCODE` | APRS-IS passcode (required) | — |
| `APRS_IS_FILTER` | Server-side filter e.g. `r/LAT/LON/KM` | _(all packets)_ |

## Rebuild

```bash
docker compose -f .appcontainer/compose.yaml build --no-cache
docker compose -f .appcontainer/compose.yaml up -d
```

## Logs

```bash
docker compose -f .appcontainer/compose.yaml logs -f
```

## Stop

```bash
docker compose -f .appcontainer/compose.yaml down
```

Data persists in the `aprs-data` Docker volume.

## Development

Open in VS Code with the Dev Containers extension, or use `devcontainer open`.

---

MIT Licence
