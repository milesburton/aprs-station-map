# Stage 1: Build frontend and backend
FROM node:22-slim AS builder

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev for build tools)
RUN npm install

# Copy source files
COPY . .

# Build frontend
RUN npm run build

# Bundle backend with esbuild (external native and cjs modules)
RUN npx esbuild src/server/index.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=esm \
 # RUN useradd -ms /bin/bash miles


# Stage 2: Runtime with Node.js + nginx + Direwolf
FROM node:22-slim

RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    curl \
    python3 \
    make \
    g++ \
    direwolf \
    alsa-utils \
    rtl-sdr \
    sox \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app


# Stage 1: Build frontend and backend
FROM node:22-slim AS builder

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev for build tools)
RUN npm install

# Copy source files
COPY . .

# Build frontend
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

# Stage 2: Runtime with Node.js + nginx + Direwolf
FROM node:22-slim

RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    curl \
    python3 \
    make \
    g++ \
    direwolf \
    alsa-utils \
    rtl-sdr \
    sox \
    gettext-base \
    && rm -rf /var/lib/apt/lists/*

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
RUN chmod +x /app/start-direwolf.sh

# Create data directories for SQLite and Direwolf logs
RUN mkdir -p /app/data /app/data/logs && chown -R node:node /app

# Supervisor config to run nginx, node backend, and direwolf
RUN mkdir -p /etc/supervisor/conf.d
COPY .appcontainer/services.conf /etc/supervisor/conf.d/services.conf

VOLUME /app/data

EXPOSE 80

# Create entrypoint script to fix permissions at runtime
RUN echo '#!/bin/sh\nchown -R node:node /app/data\nexec supervisord -c /etc/supervisor/supervisord.conf' > /entrypoint.sh && chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
