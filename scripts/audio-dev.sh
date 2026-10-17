#!/usr/bin/env bash
# Send the sandbox jukebox's audio to this machine's speakers.
#
# The container cannot read the host's PulseAudio socket directory (its uid is
# not mapped to yours), but it can reach it over TCP through the docker bridge.
# This exposes PulseAudio on the bridge only - not on the LAN.
set -euo pipefail
cd "$(dirname "$0")/.."

BRIDGE_IP=$(ip -4 -o addr show docker0 | awk '{print $4}' | cut -d/ -f1)
PORT=4713

existing=$(pactl list short modules | awk -v name=module-native-protocol-tcp '$2 == name' | grep "port=$PORT" | cut -f1 | head -1 || true)
if [ -z "$existing" ]; then
  id=$(pactl load-module module-native-protocol-tcp listen="$BRIDGE_IP" port="$PORT" auth-anonymous=1)
  echo "pulse: loaded module-native-protocol-tcp ($id) on $BRIDGE_IP:$PORT"
else
  echo "pulse: already listening on $BRIDGE_IP:$PORT (module $existing)"
fi

docker compose up -d --force-recreate >/dev/null
echo "navidrome recreated: mpv --ao=pulse -> $BRIDGE_IP:$PORT"
echo "cut the container off again:  pactl unload-module $existing"
echo "note: the module is runtime state - a pipewire/pulse restart removes it, re-run this script."
