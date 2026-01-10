# Production Container

Multi-stage Docker build with nginx + Node.js backend via supervisor.

## Rebuild After Code Changes

```bash
docker compose -f .appcontainer/compose.yaml build --no-cache
docker compose -f .appcontainer/compose.yaml up -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `STATION_CALLSIGN` | Your callsign | required |
| `STATION_LATITUDE` | Station latitude | required |
| `STATION_LONGITUDE` | Station longitude | required |
| `KISS_HOST` | TNC hostname | host.docker.internal |
| `KISS_PORT` | KISS TCP port | 8001 |
| `LOG_LEVEL` | debug, info, warn, error | info |

Data persists in the `aprs-data` Docker volume.
