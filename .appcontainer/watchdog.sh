#!/bin/bash

while true; do
    sleep 30

    if ! pgrep -x direwolf > /dev/null; then
        echo "[Watchdog] Direwolf process not running, restarting..." >&2
        supervisorctl start direwolf 2>&1 | while read line; do echo "[Watchdog] $line" >&2; done
    fi

    if ! pgrep -x "node" > /dev/null; then
        echo "[Watchdog] Backend process not running, restarting..." >&2
        supervisorctl start backend 2>&1 | while read line; do echo "[Watchdog] $line" >&2; done
    fi
done
