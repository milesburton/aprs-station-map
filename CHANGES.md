# Changes Summary

## Privacy & Generalization

### Removed Personal Information
- **Callsign**: Removed all references to M0LHA
  - Updated to generic "NOCALL" default in config
  - Updated test fixtures to use TEST-0, TEST-1 instead of M0LHA
  - Removed location references (Bexley, London)

### Updated Application Branding
- Changed from "M0LHA APRS Station Map" to "APRS Station Map"
- Removed specific location references
- Made configuration generic and environment-variable driven

## TNC Software Replacement

### Replaced Direwolf References
- Updated documentation to refer to generic "TNC with KISS protocol support"
- Removed specific Direwolf configuration examples
- Updated to focus on KISS TCP protocol connection (works with any KISS-compatible TNC)

## Container Architecture

### Separated Dev and Production Containers

All container configurations are now organized in dedicated directories:

**Production Container** ([.appcontainer/](.appcontainer/))
- Multi-stage build with Node.js 22 ([.appcontainer/Dockerfile](.appcontainer/Dockerfile))
- Runs nginx + Node.js backend via supervisor
- Optimized for production deployment with minimal image size
- Includes SQLite database persistence
- nginx configuration ([.appcontainer/nginx.conf](.appcontainer/nginx.conf))
- Docker Compose config ([.appcontainer/compose.yaml](.appcontainer/compose.yaml) references `.appcontainer/Dockerfile`)

**Development Container** ([.devcontainer/](.devcontainer/))
- Based on Node.js 22-slim ([.devcontainer/Dockerfile](.devcontainer/Dockerfile))
- Includes development tools (git, build-essential, nodemon, ts-node)
- Non-root user (devuser) for security
- VS Code integration via devcontainer.json
- Separate from production build for faster iteration

**Development Compose** ([compose.dev.yaml](compose.dev.yaml))
- Hot-reload support with volume mounting
- Uses development container image
- Separate development data volume
- Debug logging enabled
- Isolated from production environment

## Test Infrastructure

### Container Testing

**Pre-Deployment Tests** ([scripts/pre-deploy-test.sh](scripts/pre-deploy-test.sh)):
- Validates environment before building containers
- Checks Node.js, Docker, Docker Compose versions
- Verifies required files exist
- Validates TypeScript and Docker configuration
- Scans for personal information
- Confirms named volumes configured
- **Run with**: `npm run test:pre-deploy`

**Container Tests** ([scripts/test-container.sh](scripts/test-container.sh)):
- Container health validation
- HTTP server checks (nginx on port 80)
- API endpoint testing (/api/health, /api/stations, /api/stats)
- WebSocket connectivity verification
- Database volume mounting validation
- Process monitoring (supervisor, nginx, node)
- Log error scanning
- **Run with**: `npm run test:container`

### Unit Testing Migration
- **Removed**: Bun test runner references
- **Added**: Jest with ts-jest for Node.js compatibility
- Created [jest.config.js](jest.config.js) for ESM support
- Updated package.json scripts:
  - `npm test` - Run Jest tests
  - `npm run test:watch` - Watch mode
  - `npm run test:coverage` - Coverage reporting
  - `npm run test:container` - Container validation
  - `npm run sanity` - Quick health check

## Updated Dependencies

### Added Dev Dependencies
- `jest@^29.7.0` - Test runner
- `@jest/globals@^29.7.0` - Jest types
- `@testing-library/jest-dom@^6.1.5` - DOM matchers
- `@types/jest@^29.5.11` - TypeScript types
- `ts-jest@^29.1.1` - TypeScript support for Jest
- `jest-environment-jsdom@^29.7.0` - Browser-like environment

### Removed
- All Bun-specific configuration (bun.lock, bunfig.toml)
- Bun references from CI/CD workflows

## Configuration Changes

### Default Values Updated
**Before**:
- STATION_LATITUDE: 51.4416 (Bexley)
- STATION_LONGITUDE: 0.15 (Bexley)
- STATION_CALLSIGN: M0LHA

**After**:
- STATION_LATITUDE: 0 (requires configuration)
- STATION_LONGITUDE: 0 (requires configuration)
- STATION_CALLSIGN: NOCALL (requires configuration)

## Files Modified

### Container Organization
- `.appcontainer/` - NEW: Production container directory
  - `Dockerfile` - Moved from root, updated nginx path
  - `nginx.conf` - Moved from root
  - `.appcontainer/compose.yaml` - Moved from root
  - `README.md` - NEW: Container documentation
- `.devcontainer/Dockerfile` - Rebuilt for development
- `.devcontainer/devcontainer.json` - Updated for Node.js
- `.appcontainer/compose.yaml` - NEW: Root compose file referencing `.appcontainer/Dockerfile`
- `compose.dev.yaml` - NEW: Development compose file
- `.dockerignore` - NEW: Optimized Docker build context

### CI/CD
- `.github/workflows/ci.yml` - Bun → Node.js
- `.github/workflows/docker-build.yml` - Updated paths to `.appcontainer/Dockerfile`
- `scripts/test-dockerfile.sh` - Updated to use `.appcontainer/Dockerfile`

### Documentation
- `README.md` - Updated docs, removed personal info, new architecture section
- `CHANGES.md` - This file

### Application Code
- `index.html` - Removed M0LHA references
- `src/App.tsx` - Removed location-specific text
- `src/server/config.ts` - Updated defaults
- `tests/services/station-filter.test.ts` - Updated fixtures
- `tests/services/url-state.test.ts` - Updated fixtures

### Testing
- `jest.config.js` - NEW: Jest configuration
- `package.json` - Updated scripts and dependencies
- `scripts/pre-deploy-test.sh` - NEW: Pre-deployment validation
- `scripts/test-container.sh` - NEW: Container test suite
- `scripts/sanity-check.js` - Quick health check

## Running the Tests

### Recommended Workflow
```bash
# 1. Pre-deployment validation
npm run test:pre-deploy

# 2. Start the production container
docker compose -f .appcontainer/.appcontainer/compose.yaml up -d

# 3. Wait 30 seconds for startup
sleep 30

# 4. Verify deployment
npm run test:container
```

### Development Testing
```bash
# Unit tests
npm test

# Linting
npm run lint

# Type checking
npm run typecheck

# Build verification
npm run build
```

## Migration Notes

1. Users must now set environment variables for their station:
   - STATION_CALLSIGN
   - STATION_LATITUDE
   - STATION_LONGITUDE

2. Development workflow is now separate from production:
   - Use `compose.dev.yaml` for development
   - Use `.appcontainer/compose.yaml` for production

3. Tests now run with Jest instead of Bun:
   - Run `npm install` to get new dependencies
   - Run `npm test` to verify

4. Container validation is now automated:
   - `npm run test:container` validates entire stack
   - Useful for CI/CD and deployment verification
