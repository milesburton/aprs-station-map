# Stage 1: Build frontend and backend
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

RUN npm run build

# Bundle backend with esbuild (external native and cjs modules)
RUN npx esbuild src/server/index.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=esm \
    --outfile=dist-server/index.js \
    --external:better-sqlite3 \
    --external:ws

# Stage 2: Runtime — built on pre-baked base image (OS + system deps)
FROM ghcr.io/milesburton/aprs-station-map-base:latest

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json ./
RUN npm install --omit=dev

# Copy bundled backend
COPY --from=builder /app/dist-server/index.js ./dist-server/index.js

# Copy frontend build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY .appcontainer/nginx.conf /etc/nginx/sites-available/default
RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Copy Direwolf config template and startup script
COPY .appcontainer/direwolf.conf /app/direwolf.conf.template
COPY .appcontainer/start-direwolf.sh /app/start-direwolf.sh
COPY .appcontainer/watchdog.sh /app/watchdog.sh
RUN chmod +x /app/start-direwolf.sh /app/watchdog.sh

# Create data directories for SQLite and Direwolf logs
RUN mkdir -p /app/data /app/data/logs && chown -R node:node /app

# Supervisor config to run nginx, node backend, direwolf, and watchdog
RUN mkdir -p /etc/supervisor/conf.d
COPY .appcontainer/services.conf /etc/supervisor/conf.d/services.conf

# Copy entrypoint script
COPY .appcontainer/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME /app/data

EXPOSE 80

CMD ["/entrypoint.sh"]
