# APRS Station Map

```
   📡 M0LHA APRS Receiver - Bexley, London
   ═══════════════════════════════════════

        *           .    *       .
     .      🛰️    .        *
           .     *    .        *
      *        .           .
         🏠 ← You are here (probably having a cuppa)
        /|\
       / | \    ← Coverage rings (50-500km)
      /  |  \
   ──┴──┴──┴──
```

Real-time APRS station mapping application. Visualises amateur radio stations received by the M0LHA digipeater in Bexley, London, with KML data from Direwolf.

## Features

| Feature | Description |
|---------|-------------|
| 📍 Live Map | Interactive Leaflet map with station markers |
| 🔍 Filtering | Search by callsign, filter by symbol, distance |
| 📊 Statistics | Station count, average distance, furthest contact |
| 🔗 URL State | Shareable links preserve filters and map position |
| 🌙 Dark Theme | Easy on the eyes during those late-night DX sessions |
| 📱 Responsive | Works on desktop and mobile |

## Prerequisites

- Docker and Docker Compose v2 installed

That's it. No faffing about with Node versions or npm dependencies.

### Installing Docker (Raspberry Pi / Debian / Ubuntu)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in (or reboot) for group changes to take effect. Verify with:

```bash
docker compose version
```

## Quick Start

```bash
git clone https://github.com/milesburton/aprs-station-map.git
cd aprs-station-map
docker compose up -d
```

Open `http://localhost:3000` and watch the stations roll in.

## Running Continuously

The container runs as a daemon and restarts automatically unless you tell it to stop:

```bash
docker compose up -d      # Start in background
docker compose logs -f    # View live logs
docker compose stop       # Stop the container
docker compose down       # Stop and remove container
```

## Development

### Using Dev Container (Recommended)

1. Install [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
2. Open project in VS Code
3. Click "Reopen in Container"
4. Run `bun dev`

### Local Development

If you must do things the hard way:

```bash
bun install
bun dev           # Start dev server on :3000
bun test          # Run tests
bun run lint      # Check code style
bun run typecheck # TypeScript validation
bun run build     # Production build
```

## Architecture

```
src/
├── components/     # React components
│   ├── FilterPanel.tsx
│   ├── StationList.tsx
│   ├── StationMap.tsx
│   └── StationMarker.tsx
├── hooks/          # Custom React hooks
│   ├── useFilters.ts
│   ├── useMapState.ts
│   └── useStations.ts
├── services/       # Business logic
│   ├── kml-loader.ts
│   ├── station-filter.ts
│   └── url-state.ts
├── types/          # TypeScript definitions
├── utils/          # Utility functions
│   ├── geo.ts      # Distance, bearing calculations
│   ├── logger.ts   # Pino structured logging
│   └── time.ts     # Time formatting
└── constants.ts    # Configuration values
```

## Data Source

KML data fetched from:
- `https://download.milesburton.com/aprs/direwolf-stations.kml`

Refreshes every 60 seconds. The KML is exported from Direwolf running on a Raspberry Pi with an RTL-SDR dongle.

## APRS Symbol Reference

| Symbol | Meaning |
|--------|---------|
| `-` | House/QTH |
| `>` | Car |
| `k` | Truck |
| `b` | Bicycle |
| `'` | Aircraft |
| `_` | Weather station |
| `#` | Digipeater |
| `&` | Gateway |

## Tests

```bash
bun test              # Run all tests
bun test --watch      # Watch mode
bun test --coverage   # Coverage report
```

## Tech Stack

- **Runtime**: Bun
- **Framework**: React 19
- **Build**: Vite
- **Map**: Leaflet + react-leaflet
- **Logging**: Pino
- **Linting**: Biome
- **Testing**: Bun test + happy-dom
- **Container**: Docker + nginx

## Contributing

1. Fork it
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

Uses conventional commits. Biome handles formatting.

## Licence

MIT

---

*73 de M0LHA* 📻
