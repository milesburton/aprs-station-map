# APRS Station Map

[![CI](https://github.com/milesburton/aprs-station-map/actions/workflows/ci.yml/badge.svg)](https://github.com/milesburton/aprs-station-map/actions/workflows/ci.yml)
[![Docker Build](https://github.com/milesburton/aprs-station-map/actions/workflows/docker-build.yml/badge.svg)](https://github.com/milesburton/aprs-station-map/actions/workflows/docker-build.yml)

Real-time APRS station map with Direwolf TNC. Connect an audio source (RTL-SDR, sound card, or TNC) and run.

## Run

```bash
docker compose -f .appcontainer/compose.yaml up -d
```

Open http://localhost:3000

## Configuration

Create a `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `STATION_CALLSIGN` | Your callsign (e.g. `YOURCALL-10`) | required |
| `STATION_LATITUDE` | Station latitude (decimal degrees) | required |
| `STATION_LONGITUDE` | Station longitude (decimal degrees) | required |
| `AUDIO_SOURCE` | `rtl-sdr`, `soundcard`, or `null` | `rtl-sdr` |
| `RTL_FREQ` | RTL-SDR frequency | `144.8M` |
| `RTL_GAIN` | RTL-SDR gain (dB) — start low (~25–30) and adjust | `30` |
| `RTL_PPM` | RTL-SDR PPM frequency correction | `0` |
| `APRS_IS_SERVER` | APRS-IS server for internet gating | `rotate.aprs2.net` |
| `APRS_IS_PORT` | APRS-IS server port | `14580` |
| `APRS_IS_PASSCODE` | APRS-IS passcode — leave empty to disable igating | _(disabled)_ |

### APRS-IS Internet Gating

To relay received RF packets to the APRS-IS network (igating), set your callsign and passcode:

```env
STATION_CALLSIGN=YOURCALL-10
APRS_IS_PASSCODE=12345
```

Generate your passcode from your base callsign (no SSID) at https://apps.magicbug.co.uk/passcode/

When `APRS_IS_PASSCODE` is set and `STATION_CALLSIGN` is not `NOCALL`, Direwolf will connect to `rotate.aprs2.net` and relay received packets automatically.

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
