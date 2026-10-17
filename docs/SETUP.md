# Setup

## Ports

| Port | What | Bound to |
| --- | --- | --- |
| 4533 | throwaway Navidrome (docker) | `127.0.0.1` |
| 3101 | Juuku API (and the built UI after `npm run build`) | `127.0.0.1` |
| 3100 | Vite dev server (proxies `/api` → 3101) | `127.0.0.1` |

8080 is **not** free on this machine — the Ghosted dev site owns it. That is why the app sits on 3100 (the usual port convention here) and the API on 3101.

## Testing from a phone (LAN)

`npm run dev` binds Vite to `0.0.0.0:3100`, so on this machine the phone opens `http://10.10.10.20:3100/`. The API is proxied by Vite to `127.0.0.1:3101`, but this machine's `.env` also sets `HOST=0.0.0.0` for the API so the built app (`npm run build && npm start`) is reachable too.

Verified through a real external hop (the Pi on the same LAN): `:3100` and `:3101/api/health` both answer 200, so firewalld already allows both ports. If a port is ever closed: `sudo firewall-cmd --add-port=3100/tcp` (add `--permanent` to survive a reload).

There is **no authentication** in front of Juuku, so on the LAN anyone can play, skip and rewrite the queue, and `/api/*` is open. Fine for a home network while this is a POC; not something to expose to the internet. The committed `.env.example` keeps `HOST=127.0.0.1` for that reason.

## Deploy with Docker

The image is self-contained: it builds the SPA, serves it and the API from the
same origin on one port, and keeps nothing on disk.

```sh
git clone https://github.com/nomorenamesstudio/juuku && cd juuku
cp deploy/.env.example deploy/.env      # then edit it
cd deploy && docker compose up -d
```

`deploy/compose.yml` publishes `3101` on the LAN, runs read-only as uid 1000 with
no capabilities, and healthchecks `/api/live` (liveness only, so a Navidrome
outage does not mark the app unhealthy).

Configuration is environment only — nothing is baked into the image:

| variable | meaning |
|---|---|
| `NAVIDROME_URL` | base URL of the Navidrome to drive, e.g. `http://navidrome:4533` |
| `NAVIDROME_USER` | a dedicated, non-admin Navidrome user |
| `NAVIDROME_PASSWORD` | that user's password |
| `HOST` / `PORT` | bind address and port inside the container (`0.0.0.0:3101`) |
| `JUUKU_PASSWORD` | optional shared password; unset means no login at all |
| `NODE_EXTRA_CA_CERTS` | optional, for a Navidrome behind a private CA |

If Navidrome runs in another compose stack, attach Juuku to that stack's network
and use the service name as the host (`http://navidrome:4533`); the commented
`networks:` block in `deploy/compose.yml` is that case. A Navidrome on another
host is just its LAN address.

Tagged releases publish a multi-arch image (amd64 + arm64, so a Pi pulls natively):

```sh
docker pull ghcr.io/nomorenamesstudio/juuku:latest
```

Set `JUUKU_PASSWORD` and the app asks for it once per browser (a 30-day HttpOnly
cookie, signed with a key derived from the password — change the password and
every session ends). Failed attempts are throttled per address. Leaving it unset
keeps the old behaviour: no login, LAN only.

Read [SECURITY.md](../SECURITY.md) before exposing the port to anything beyond your
own network — the app has no login by design.

## Pointing at another Navidrome (e.g. the main library)

Read-only is fine: a server with jukebox mode off answers 501 for `jukeboxControl`, and the app shows no queue instead of failing. Credentials stay out of git:

```sh
NAVIDROME_URL=http://10.10.10.10:4533 NAVIDROME_USER=juuku NAVIDROME_PASSWORD=… \
  ./scripts/remote-instance.sh 3102
```

Environment variables win over `.env`, so the sandbox on `:3100` keeps running unchanged. On the Pi the `juuku` user was created with `docker exec -it navidrome /app/navidrome user create --username juuku --name Juuku` (no password flag - it prompts twice, so it needs a TTY). Playback through that instance would need `Jukebox.Enabled`, `mpv` and an audio device on the Pi first.

## The throwaway Navidrome

Never point development at the Pi instance. `docker-compose.yml` runs a separate Navidrome with jukebox enabled:

- container `juuku-navidrome`, project `juuku`
- `Jukebox.Enabled=true`, `MPVCmdTemplate` with `--ao=pulse` (real audio, see below)
- `Jukebox.AdminOnly=true`
- `mpv` is already inside the `navidrome/navidrome` image — nothing to install
- volumes: `juuku_navidrome-data` (`/data`) and `juuku_navidrome-music` (`/music`)

```sh
./scripts/sandbox-up.sh
```

The script starts the container, seeds the music volume from `sandbox/music` if empty, creates the first admin (`admin` / `juuku` by default, via `/auth/createAdmin` — that endpoint only exists while the user table is empty), and forces a scan.

`sandbox/music` is gitignored: it holds two albums copied from the Pi library (Daft Punk — *Human After All*, Röyksopp — *Do It Again*, 15 tracks). Replace or extend them and re-run the script; `docker compose down -v` resets both volumes.

## Hearing it

The container cannot open the host's PulseAudio socket — its uid is not mapped to yours, so even a bind mount of `pipewire-0` gets `Permission denied`. It can reach it over TCP through the docker bridge instead:

```sh
./scripts/audio-dev.sh
```

That script loads `module-native-protocol-tcp` on `172.17.0.1:4713` (bridge only, not the LAN) and recreates the container with `PULSE_SERVER=tcp:172.17.0.1:4713`. mpv then plays into whatever PipeWire default sink you have, mixed with everything else — no device stealing, and your normal listening keeps running.

Consequences:

- The module is runtime state, not config: a PipeWire restart or reboot drops it, and mpv's connection with it. Re-run the script and restart the container.
- `pactl unload-module <id>` cuts the container off again (the script prints the id).
- Auth is `auth-anonymous=1` but bound to the docker bridge, so only local containers can use it. Fine for a dev box, not a pattern to copy onto a shared host.
- Per-track audio is `pulse/...` device names; `Jukebox.Devices` / `Jukebox.Default` are unset on purpose so it always follows the current default sink.

## Credentials

`.env` (gitignored), see `.env.example`:

```
NAVIDROME_URL=http://127.0.0.1:4533
NAVIDROME_USER=admin
NAVIDROME_PASSWORD=juuku
PORT=3101
```

The sandbox password is not a secret — the container is bound to loopback and holds two albums. A real instance needs a real credential and, if it is ever exposed beyond the LAN, real auth in front of Juuku itself.

## Environment traps found while building this

1. **Containers cannot read workspace bind mounts on this machine.** Even root inside a container gets `Permission denied` on `/home/k/Code/...`, while named volumes work fine. Hence music and data live in named volumes, seeded with `docker cp`, instead of `./sandbox/music:/music`.
2. **`npm install` fails with `EROFS`** because `~/.npm/_cacache` is read-only under the file sandbox. Use a workspace cache: `npm install --cache "$PWD/.tmp/npm-cache"`.
3. **A container's mpv cannot see the host audio socket** (uid mapping again), and busctl/dbus is unusable from there too — hence the TCP bridge instead of mounting `/run/user/1000/pulse`.
4. **Navidrome's dev-admin env vars are gone** in 0.64.x. New installs create the first admin through the web UI, or `POST /auth/createAdmin` while the user table is empty; after that, `navidrome user create` from the CLI.

## Verifying the jukebox without the UI

```sh
PASS=juuku; salt=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \n')
token=$(printf '%s%s' "$PASS" "$salt" | md5sum | cut -d' ' -f1)
AUTH="u=admin&t=$token&s=$salt&v=1.16.1&c=Juuku&f=json"
curl -s "http://127.0.0.1:4533/rest/jukeboxControl?$AUTH&action=status"
```

If jukebox is wired up, `docker logs juuku-navidrome` says "Starting playback server" and "Using audio device: auto".
