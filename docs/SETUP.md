# Setup

## Ports

| Port | What | Bound to |
| --- | --- | --- |
| 4533 | throwaway Navidrome (docker) | `127.0.0.1` |
| 3101 | Juicebox API (and the built UI after `npm run build`) | `127.0.0.1` |
| 3100 | Vite dev server (proxies `/api` → 3101) | `127.0.0.1` |

8080 is **not** free on this machine — the Ghosted dev site owns it. That is why the app sits on 3100 (the usual port convention here) and the API on 3101.

## The throwaway Navidrome

Never point development at the Pi instance. `docker-compose.yml` runs a separate Navidrome with jukebox enabled:

- container `juicebox-navidrome`, project `juicebox`
- `Jukebox.Enabled=true`, `MPVCmdTemplate` with `--ao=null` (silent, but the position still advances)
- `Jukebox.AdminOnly=true`
- `mpv` is already inside the `navidrome/navidrome` image — nothing to install
- volumes: `juicebox_navidrome-data` (`/data`) and `juicebox_navidrome-music` (`/music`)

```sh
./scripts/sandbox-up.sh
```

The script starts the container, seeds the music volume from `sandbox/music` if empty, creates the first admin (`admin` / `juicebox` by default, via `/auth/createAdmin` — that endpoint only exists while the user table is empty), and forces a scan.

`sandbox/music` is gitignored: it holds two albums copied from the Pi library (Daft Punk — *Human After All*, Röyksopp — *Do It Again*, 15 tracks). Replace or extend them and re-run the script; `docker compose down -v` resets both volumes.

## Credentials

`.env` (gitignored), see `.env.example`:

```
NAVIDROME_URL=http://127.0.0.1:4533
NAVIDROME_USER=admin
NAVIDROME_PASSWORD=juicebox
PORT=3101
```

The sandbox password is not a secret — the container is bound to loopback and holds two albums. A real instance needs a real credential and, if it is ever exposed beyond the LAN, real auth in front of Juicebox itself.

## Environment traps found while building this

1. **Containers cannot read workspace bind mounts on this machine.** Even root inside a container gets `Permission denied` on `/home/k/Code/...`, while named volumes work fine. Hence music and data live in named volumes, seeded with `docker cp`, instead of `./sandbox/music:/music`.
2. **`npm install` fails with `EROFS`** because `~/.npm/_cacache` is read-only under the file sandbox. Use a workspace cache: `npm install --cache "$PWD/.tmp/npm-cache"`.
3. **Navidrome's dev-admin env vars are gone** in 0.64.x. New installs create the first admin through the web UI, or `POST /auth/createAdmin` while the user table is empty; after that, `navidrome user create` from the CLI.

## Verifying the jukebox without the UI

```sh
PASS=juicebox; salt=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')
token=$(printf '%s%s' "$PASS" "$salt" | md5sum | cut -d' ' -f1)
AUTH="u=admin&t=$token&s=$salt&v=1.16.1&c=Juicebox&f=json"
curl -s "http://127.0.0.1:4533/rest/jukeboxControl?$AUTH&action=status"
```

If jukebox is wired up, `docker logs juicebox-navidrome` says "Starting playback server" and "Using audio device: auto".
