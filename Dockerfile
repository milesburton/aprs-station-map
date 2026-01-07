# Stage 1: Build frontend
FROM node:22-slim AS frontend-builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Runtime with Bun + nginx
FROM oven/bun:1.2-alpine

# Install nginx and supervisor
RUN apk add --no-cache nginx supervisor

WORKDIR /app

# Copy backend source
COPY src/server ./src/server
COPY tsconfig.json ./

# Copy frontend build
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Create data directory for SQLite
RUN mkdir -p /app/data

# Supervisor config to run both nginx and bun
RUN mkdir -p /etc/supervisor.d
COPY <<EOF /etc/supervisor.d/services.ini
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
command=bun run src/server/index.ts
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

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
