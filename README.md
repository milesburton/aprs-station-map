
# APRS Station Map

Live APRS station map with real-time updates, filtering, and statistics. Visualise and explore amateur radio activity on an interactive web map.

**Fully self-contained** - includes integrated Direwolf TNC for APRS packet decoding. Just connect an audio source (RTL-SDR, sound card, or TNC) and run.

## Quick Start

```bash
git clone https://github.com/milesburton/aprs-station-map.git
cd aprs-station-map
docker compose -f .appcontainer/compose.yaml up -d
```

Open your browser at http://localhost:3000

The container includes:
- Web frontend with interactive map
- Node.js backend with WebSocket support
- Direwolf TNC for APRS decoding
- SQLite database for station persistence

## Viewing Logs

```bash
docker compose -f .appcontainer/compose.yaml logs -f
```

## Stopping and Removing

```bash
docker compose -f .appcontainer/compose.yaml stop
docker compose -f .appcontainer/compose.yaml down
```

## Health Check

```bash
docker inspect --format='{{json .State.Health.Status}}' aprs-station-map
```

## Configuration


### RTL-SDR Setup

Create a `.env` file in your project root with:

```env
STATION_CALLSIGN=M0XYZ
STATION_LATITUDE=51.5074
STATION_LONGITUDE=-0.1278
AUDIO_SOURCE=rtl-sdr
RTL_FREQ=144.8M
RTL_GAIN=40
RTL_PPM=0
```

Then start the container:

```bash
docker compose -f .appcontainer/compose.yaml up -d
```


### Sound Card Setup

Edit your `.env` file:

```env
STATION_CALLSIGN=M0XYZ
STATION_LATITUDE=51.5074
STATION_LONGITUDE=-0.1278
AUDIO_SOURCE=soundcard
```

Then start the container:

```bash
docker compose -f .appcontainer/compose.yaml up -d
```


### Test Mode (No Audio)

Edit your `.env` file:

```env
STATION_CALLSIGN=M0XYZ
AUDIO_SOURCE=null
```

Then start the container:

```bash
docker compose -f .appcontainer/compose.yaml up -d
```

## Diagnostics

Check container logs to verify Direwolf is decoding packets:

```bash
docker compose -f .appcontainer/compose.yaml logs -f
```

The web interface shows real-time diagnostics including KISS TNC connection status and packet reception.

### Raspberry Pi / Linux Docker Setup (optional)

To install Docker on Raspberry Pi or Debian/Ubuntu:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in (or reboot) for group changes to take effect. Verify with:

```bash
docker compose version
```

---

MIT Licence

