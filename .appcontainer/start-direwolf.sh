#!/bin/bash
set -e

export STATION_CALLSIGN="${STATION_CALLSIGN:-NOCALL}"
export STATION_LATITUDE="${STATION_LATITUDE:-51.4416}"
export STATION_LONGITUDE="${STATION_LONGITUDE:-0.15}"

envsubst < /app/direwolf.conf.template > /app/direwolf.conf

exec direwolf -c /app/direwolf.conf
