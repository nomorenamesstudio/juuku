#!/usr/bin/env bash
# Serve the built app against another Navidrome (a live library, say)
# without touching the local sandbox. Secrets stay in the environment, never in git.
#
#   NAVIDROME_URL=http://navidrome.example.lan:4533 NAVIDROME_USER=me NAVIDROME_PASSWORD=… \
#     ./scripts/remote-instance.sh 3102
set -euo pipefail
cd "$(dirname "$0")/.."

: "${NAVIDROME_URL:?set NAVIDROME_URL}"
: "${NAVIDROME_USER:?set NAVIDROME_USER}"
: "${NAVIDROME_PASSWORD:?set NAVIDROME_PASSWORD}"

PORT="${1:-3102}"
[ -d dist ] || { echo "no dist/ - run npm run build first" >&2; exit 1; }

echo "juuku remote instance: $NAVIDROME_URL as $NAVIDROME_USER on :$PORT"
exec env PORT="$PORT" node server/index.mjs
