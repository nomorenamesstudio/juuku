#!/usr/bin/env bash
# Bring the throwaway Navidrome up, seed music + admin, and force a scan.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE=${NAVIDROME_URL:-http://127.0.0.1:4533}
USER=${NAVIDROME_USER:-admin}
PASS=${NAVIDROME_PASSWORD:-juuku}

docker compose up -d

for _ in $(seq 1 40); do
  curl -sf -o /dev/null "$BASE/ping" && break
  sleep 0.5
done

if ! docker exec juuku-navidrome sh -c '[ -n "$(ls -A /music 2>/dev/null)" ]'; then
  if [ -z "$(ls -A sandbox/music 2>/dev/null)" ]; then
    echo "sandbox/music is empty - drop a few albums in there and run this again" >&2
  else
    echo "seeding music volume..."
    docker cp sandbox/music/. juuku-navidrome:/music
  fi
fi

# First-run admin: /auth/createAdmin only exists while the user table is empty.
curl -sf -X POST "$BASE/auth/createAdmin" -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" >/dev/null 2>&1 || true

salt=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')
token=$(printf '%s%s' "$PASS" "$salt" | md5sum | cut -d' ' -f1)
AUTH="u=$USER&t=$token&s=$salt&v=1.16.1&c=Juuku&f=json"

curl -sf "$BASE/rest/startScan?$AUTH" >/dev/null || true
for _ in $(seq 1 60); do
  status=$(curl -sf "$BASE/rest/getScanStatus?$AUTH")
  echo "$status" | grep -q '"scanning":false' && break
  sleep 1
done

echo "albums: $(curl -sf "$BASE/rest/getAlbumList2?$AUTH&type=alphabeticalByName&size=500" | grep -o '"id":"' | wc -l)"
echo "jukebox: $(curl -sf "$BASE/rest/jukeboxControl?$AUTH&action=status")"
