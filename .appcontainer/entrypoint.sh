#!/bin/sh
set -e

# Fix permissions
chown -R node:node /app/data

# Export environment variables for supervisord interpolation
export NODE_ENV="${NODE_ENV:-production}"
export DATA_SOURCE="${DATA_SOURCE:-kiss}"
export APRS_IS_PORT="${APRS_IS_PORT:-14580}"
export AIS_SOURCE="${AIS_SOURCE:-none}"
export DATABASE_PATH="${DATABASE_PATH:-/app/data/stations.db}"

# Start supervisord
exec supervisord -c /etc/supervisor/supervisord.conf
