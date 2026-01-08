
# APRS Station Map

Live APRS station map with real-time updates, filtering, and statistics. Visualise and explore amateur radio activity on an interactive web map.

## Quick Start

```bash
git clone https://github.com/milesburton/aprs-station-map.git
cd aprs-station-map
docker compose -f .appcontainer/compose.yaml up -d
```

Open your browser at http://localhost:3000

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

## Diagnostics

Test KISS TNC connectivity:

```bash
npm run diagnose:kiss
```

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

