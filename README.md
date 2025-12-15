# APRS Station Map

A lightweight web app that displays APRS stations heard by M0LHA (Bexley, London) using Leaflet and KML data exported from Direwolf.

## Overview
- Visualizes latest known positions of stations, distinguishing direct vs digipeated reception.
- Optional overlays: distance rings, coverage “heatmap,” and movement tracks for mobile stations.
- URL state sharing: current map view, filter settings, and selected station are encoded in the URL hash.

## Project Structure
- index.html — Main HTML shell
- css/style.css — Styles extracted from the original single-file page
- js/main.js — Application logic (map init, controls, KML loading, filters)
- direwolf-stations.kml — Example KML (local copy if needed; app fetches remote by default)

## Running Locally
You can open `index.html` directly in a modern browser. If your browser blocks local cross-origin requests, serve the folder:

```bash
# Python 3
python -m http.server 8080
# or Node.js (if installed)
npx serve .
```
Then visit http://localhost:8080

## Data Source
By default, the app fetches KML data from:
- https://download.milesburton.com/aprs/direwolf-stations.kml

If you prefer a local file, update `kmlUrl` inside `js/main.js` to point at `direwolf-stations.kml` in the repo.

## Features
- Direct vs Digipeated filters (mutually exclusive)
- Time window filter with slider (minutes to 24 hours)
- Plausibility filter (drops 0,0 and >600 km from Bexley)
- Clickable callsigns in popups (quick navigation)
- Share URL button (copies current view + filters)

## Notes
- Leaflet and togeojson UMD builds are loaded via CDN in `index.html`.
- Tracks are derived from LineString features and are independent of the time filter except for per-point timestamps when available.
- The map auto-refreshes KML every 60 seconds while preserving view and selection.
