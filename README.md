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

```env
STATION_CALLSIGN=M0XYZ
STATION_LATITUDE=51.5074
STATION_LONGITUDE=-0.1278
AUDIO_SOURCE=rtl-sdr  # or: soundcard, null
RTL_FREQ=144.8M
RTL_GAIN=40
RTL_PPM=0
```

## Logs

```bash
docker compose -f .appcontainer/compose.yaml logs -f
```

## Stop

```bash
docker compose -f .appcontainer/compose.yaml down
```

---

MIT Licence

