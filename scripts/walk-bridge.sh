#!/usr/bin/env bash
# Walk-with-your-MacBook mode: feed the Mac's Wi-Fi-derived location into the
# iOS Simulator as simulated GPS, so Fogwalk reveals fog on real walks without
# a paired iPhone.
#
# Usage:
#   caffeinate -dis ./scripts/walk-bridge.sh [simulator-udid]
#
# (caffeinate keeps the Mac awake while walking; udid defaults to "booted".)
#
# Requires:
#   brew install corelocationcli
#   System Settings > Privacy & Security > Location Services: allow CoreLocationCLI
#   The Fogwalk simulator booted, Metro running, and internet for map tiles
#   (tether to a phone hotspot when away from home Wi-Fi).
#
# Notes:
#   - Mac positioning is Wi-Fi-based: ~20-100 m in dense areas, may drop out in
#     parks/open spaces. Position jumps faster than 15 km/h are filtered by the
#     app's speed gate, so occasional teleports are harmless.
set -u

DEVICE="${1:-booted}"
INTERVAL=3

echo "Bridging Mac location -> simulator ($DEVICE) every ${INTERVAL}s. Ctrl-C to stop."

while true; do
  # CoreLocationCLI prints "lat lng" space-separated (its -format flag is
  # unreliable across versions); convert to the "lat,lng" simctl expects.
  LOC=$(CoreLocationCLI -once 2>/dev/null | awk 'NF >= 2 { print $1 "," $2; exit }')
  if [[ "$LOC" =~ ^-?[0-9]+\.[0-9]+,-?[0-9]+\.[0-9]+$ ]]; then
    if xcrun simctl location "$DEVICE" set "$LOC" 2>/dev/null; then
      echo "$(date +%T)  $LOC"
    else
      echo "$(date +%T)  simulator not booted?"
    fi
  else
    echo "$(date +%T)  no fix (Wi-Fi positioning unavailable here)"
  fi
  sleep "$INTERVAL"
done
