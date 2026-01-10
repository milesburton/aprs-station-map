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
| `STATION_CALLSIGN` | Your callsign | required |
| `STATION_LATITUDE` | Station latitude | required |
| `STATION_LONGITUDE` | Station longitude | required |
| `AUDIO_SOURCE` | rtl-sdr, soundcard, or null | rtl-sdr |
| `RTL_FREQ` | RTL-SDR frequency | 144.8M |
| `RTL_GAIN` | RTL-SDR gain | 40 |
| `RTL_PPM` | RTL-SDR PPM correction | 0 |

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
