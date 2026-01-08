
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

Set your station details via environment variables:

```bash
export STATION_CALLSIGN=M0XYZ
export STATION_LATITUDE=51.5074
export STATION_LONGITUDE=-0.1278
docker compose -f .appcontainer/compose.yaml up -d
```

## Audio Input

Direwolf inside the container can receive audio from:

**RTL-SDR**: Pipe rtl_fm output into the container
```bash
rtl_fm -f 144.8M - | docker exec -i aprs-station-map direwolf -c /app/direwolf.conf -
```

**Sound Card**: The container has access to `/dev/snd` for direct audio input

**Network TNC**: Set `ADEVICE` in direwolf.conf to read from a network source

## Diagnostics

Check container logs to verify Direwolf is decoding packets:

```bash
docker compose -f .appcontainer/compose.yaml logs -f
```

The web interface shows real-time diagnostics including KISS TNC connection status and packet reception.

## Auto-Update (Optional)

Enable automatic updates to pull the latest code and rebuild the container hourly:

```bash
# Copy service file to systemd
sudo cp scripts/aprs-auto-update.service /etc/systemd/system/

# Enable and start the service
sudo systemctl enable aprs-auto-update
sudo systemctl start aprs-auto-update

# Check status
sudo systemctl status aprs-auto-update

# View logs
sudo journalctl -u aprs-auto-update -f
```

To customize the update interval, edit `/etc/systemd/system/aprs-auto-update.service` and change the `CHECK_INTERVAL` environment variable (in seconds).

---

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

