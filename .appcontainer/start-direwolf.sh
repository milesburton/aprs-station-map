#!/bin/bash
set -e

export STATION_CALLSIGN="${STATION_CALLSIGN:-NOCALL}"
export STATION_LATITUDE="${STATION_LATITUDE:-51.4416}"
export STATION_LONGITUDE="${STATION_LONGITUDE:-0.15}"
export AUDIO_SOURCE="${AUDIO_SOURCE:-null}"
export RTL_FREQ="${RTL_FREQ:-144.8M}"
export RTL_GAIN="${RTL_GAIN:-40}"
export RTL_PPM="${RTL_PPM:-0}"

# Create named pipe for spectrum analyzer if it doesn't exist
AUDIO_PIPE="/tmp/aprs-audio-pipe"
if [ ! -p "$AUDIO_PIPE" ]; then
    rm -f "$AUDIO_PIPE"
    mkfifo "$AUDIO_PIPE"
    chmod 666 "$AUDIO_PIPE"
    echo "Created audio pipe at $AUDIO_PIPE"
fi

case "$AUDIO_SOURCE" in
  rtl-sdr)
    export AUDIO_DEVICE="null null"
    envsubst < /app/direwolf.conf.template > /app/direwolf.conf
    echo "Starting RTL-SDR -> Direwolf pipeline with spectrum tap"
    echo "Frequency: $RTL_FREQ, Gain: $RTL_GAIN, PPM: $RTL_PPM"
    echo "Audio pipe: $AUDIO_PIPE"
    # Use wider bandwidth for better signal capture
    # -s 22050: Audio sample rate (Direwolf works best with 11025, 22050, or 44100)
    # -E dc: Enable DC blocking filter
    # -F 9: Enable fast atan math
    # -l 0: Squelch level 0 (disabled)
    # -d akk: Debug audio, kiss, and modem reception (shows decode attempts)
    # tee copies audio to named pipe for spectrum analyzer while passing to direwolf
    exec rtl_fm -M fm -f "$RTL_FREQ" -s 22050 -g "$RTL_GAIN" -p "$RTL_PPM" -l 0 -E dc -F 9 - | tee "$AUDIO_PIPE" | direwolf -c /app/direwolf.conf -r 22050 -d akk -t 0 -
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
