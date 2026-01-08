#!/bin/bash
set -e

export STATION_CALLSIGN="${STATION_CALLSIGN:-NOCALL}"
export STATION_LATITUDE="${STATION_LATITUDE:-51.4416}"
export STATION_LONGITUDE="${STATION_LONGITUDE:-0.15}"
export AUDIO_SOURCE="${AUDIO_SOURCE:-null}"
export RTL_FREQ="${RTL_FREQ:-144.8M}"
export RTL_GAIN="${RTL_GAIN:-40}"
export RTL_PPM="${RTL_PPM:-0}"

case "$AUDIO_SOURCE" in
  rtl-sdr)
    export AUDIO_DEVICE="null null"
    envsubst < /app/direwolf.conf.template > /app/direwolf.conf
    echo "Starting RTL-SDR -> Direwolf pipeline"
    echo "Frequency: $RTL_FREQ, Gain: $RTL_GAIN, PPM: $RTL_PPM"
    exec rtl_fm -f "$RTL_FREQ" -s 24000 -g "$RTL_GAIN" -p "$RTL_PPM" - | direwolf -c /app/direwolf.conf -r 24000 -D 1 -
    ;;
  soundcard)
    export AUDIO_DEVICE="plughw:0,0"
    envsubst < /app/direwolf.conf.template > /app/direwolf.conf
    echo "Starting Direwolf with sound card input: $AUDIO_DEVICE"
    exec direwolf -c /app/direwolf.conf
    ;;
  *)
    export AUDIO_DEVICE="null"
    envsubst < /app/direwolf.conf.template > /app/direwolf.conf
    echo "Starting Direwolf with null audio device (awaiting stdin or network)"
    exec direwolf -c /app/direwolf.conf
    ;;
esac
