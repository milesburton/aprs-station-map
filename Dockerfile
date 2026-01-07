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
COPY package.json bun.lock* ./

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

# Stage 2: Runtime with Node.js + nginx
FROM node:22-slim

# Install nginx, supervisor, and build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json ./
RUN npm install --omit=dev

# Copy bundled backend
COPY --from=builder /app/dist-server ./dist-server

# Copy frontend build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/sites-available/default
RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Create data directory for SQLite
RUN mkdir -p /app/data

# Supervisor config to run both nginx and node
RUN mkdir -p /etc/supervisor/conf.d
COPY <<EOF /etc/supervisor/conf.d/services.conf
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:backend]
command=node dist-server/index.js
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=DATABASE_PATH="/app/data/stations.db"
EOF

VOLUME /app/data

EXPOSE 80

CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
