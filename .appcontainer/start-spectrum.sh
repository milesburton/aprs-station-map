#!/bin/bash
set -e

# Configuration from environment
RTL_FREQ="${RTL_FREQ:-144548000}"
RTL_GAIN="${RTL_GAIN:-40}"
RTL_PPM="${RTL_PPM:-0}"

# Calculate frequency range (±50kHz around center)
CENTER_FREQ=$RTL_FREQ
BANDWIDTH=100000  # 100 kHz total bandwidth

# rtl_power parameters:
# -f: frequency range (start:stop)
# -g: tuner gain
# -p: PPM error
# -i: integration interval (seconds)
# -1: single shot mode (continuous for streaming)
# -e: exit time (not used, run continuously)
# bins: number of FFT bins

echo "Starting RTL-SDR spectrum analyzer"
echo "Center: $CENTER_FREQ Hz, Bandwidth: ±50kHz, Gain: $RTL_GAIN dB"

# Use rtl_power for FFT data
# Output to stdout which can be consumed by the backend
exec rtl_power -f $(($CENTER_FREQ - 50000)):$(($CENTER_FREQ + 50000)):1000 \
    -g $RTL_GAIN \
    -p $RTL_PPM \
    -i 0.1 \
    -1 \
    -
