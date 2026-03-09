# Configuration Guide

## Quick Start for Internet-Only Mode (No Radio Required)

If you're running the app without radio hardware and want to receive APRS data from the internet, create a `.env` file in the project root:

```env
# Data source: use 'aprs-is' for internet data, 'kiss' for local radio
DATA_SOURCE=aprs-is

# Your station details (use your actual location)
STATION_CALLSIGN=NOCALL
STATION_LATITUDE=51.5074
STATION_LONGITUDE=-0.1278

# APRS-IS settings (internet feed)
APRS_IS_SERVER=rotate.aprs2.net
APRS_IS_PORT=14580
APRS_IS_PASSCODE=-1
# Filter for stations within 200km of your location
APRS_IS_FILTER=r/51.5074/-0.1278/200
```

**Important:**
- `DATA_SOURCE=aprs-is` tells the system to use internet APRS feed
- `APRS_IS_PASSCODE=-1` is read-only access (no transmitting)
- Update `STATION_LATITUDE` and `STATION_LONGITUDE` to your actual location
- Update `APRS_IS_FILTER` to match your location (format: `r/LAT/LON/RADIUS_KM`)

## Why No Data Appears Without Configuration

By default (without a `.env` file), the system:
1. Uses `DATA_SOURCE=kiss` (expects local radio hardware)
2. Sets station location to `0,0` (off the coast of Africa)
3. Uses callsign `NOCALL`
4. Tries to connect to `localhost:8001` (KISS TNC/Direwolf)

This results in:
- ❌ No APRS-IS internet connection
- ❌ No radio hardware connection
- ❌ No data appears on the map

## Running the Server

After creating your `.env` file:

```bash
# Install dependencies (first time only)
npm install

# Start the server
npm run dev
```

Then open http://localhost:4173 in your browser.

## Checking If It's Working

Once the server starts, you should see:
```
[Server] Data source: APRS-IS (rotate.aprs2.net:14580)
[APRS-IS] Connected to rotate.aprs2.net:14580
[APRS-IS] Sent login for NOCALL with filter: r/51.5074/-0.1278/200
[APRS-IS] Server: # logresp NOCALL verified, server T2SERVER
```

Within a few minutes, you should see APRS packets being received and stations appearing on the map.

## Advanced Configuration

See [.env.example](./.env.example) for all available options including:
- Radio/TNC configuration (`DATA_SOURCE=kiss`)
- AIS (ship tracking) integration
- Database settings
- Port configuration
