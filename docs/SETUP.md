# Setup

## Ports

| Port | What | Bound to |
| --- | --- | --- |
| 4533 | throwaway Navidrome (docker) | `127.0.0.1` |
| 3101 | Juuku API (and the built UI after `npm run build`) | `127.0.0.1` |
| 3100 | Vite dev server (proxies `/api` → 3101) | `127.0.0.1` |

Those are defaults, not requirements: `PORT` moves the API and `server.port` in
`vite.config.ts` moves the dev server. Change them if they clash with something you
already run.

## Testing from a phone (LAN)

`npm run dev` binds Vite to `0.0.0.0:3100`, so from a phone on the same network open
`http://<your-machine>:3100/`. Vite proxies `/api` to `127.0.0.1:3101`; set `HOST=0.0.0.0`
in `.env` too if you want the built app (`npm run build && npm start`) reachable from
the phone as well. Open both ports in your firewall if one is running, e.g.
`sudo firewall-cmd --add-port=3100/tcp` (add `--permanent` to survive a reload).

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
| `NAVIDROME_USER` | the Navidrome account Juuku signs in as — **it has to be an admin**, see below |
| `NAVIDROME_PASSWORD` | that user's password |
| `HOST` / `PORT` | bind address and port inside the container (`0.0.0.0:3101`) |
| `JUUKU_PASSWORD` | optional shared password; unset means no login at all |
| `NODE_EXTRA_CA_CERTS` | optional, for a Navidrome behind a private CA |

### The Navidrome account, and `Jukebox.AdminOnly`

Navidrome ships `Jukebox.AdminOnly` set to **true** (the options reference lists it,
the jukebox feature page does not), so a non-admin account is refused with
`Jukebox is admin only (code 50)` even with jukebox mode enabled. Two ways out:

```sh
# preferred: keep the user least-privileged
ND_JUKEBOX_ADMINONLY=false        # in Navidrome's environment, then restart it
```

```sh
# or promote the account (it then has full Navidrome admin rights)
docker exec navidrome /app/navidrome user edit --user <user> --set-admin
```

Juuku is fine with either — the account only needs to browse, play and manage its
own playlists. Use a dedicated account either way, and keep its password in
`deploy/.env` on the host (mode 600) and nowhere else.

Navidrome also needs `mpv` (the official image ships it) and the sound card. In
compose that means `ND_JUKEBOX_ENABLED=true`, `devices: ["/dev/snd:/dev/snd"]` and
the host `audio` group via `group_add`. Leave `Jukebox.Default` alone: it is a
*symbolic* name from `Jukebox.Devices`, which cannot be set from the environment,
so the default (`auto`) is the right choice for a single output. Get the device
names with `docker run --rm --device /dev/snd --entrypoint mpv <image>
--audio-device=help` if you ever need them.

If Navidrome runs in another compose stack, attach Juuku to that stack's network
and use the service name as the host (`http://navidrome:4533`); the commented
`networks:` block in `deploy/compose.yml` is that case. A Navidrome on another
host is just its LAN address.

Tagged releases publish a multi-arch image (amd64 + arm64, so a Raspberry Pi or an
ARM server pulls natively):

```sh
docker pull ghcr.io/nomorenamesstudio/juuku:latest
```

Set `JUUKU_PASSWORD` and the app asks for it once per browser (a 30-day HttpOnly
cookie, signed with a key derived from the password — change the password and
every session ends). Failed attempts are throttled per address. Leaving it unset
keeps the old behaviour: no login, LAN only.

Read [SECURITY.md](../SECURITY.md) before exposing the port to anything beyond your
own network — the app has no login by design.

## Behind a path prefix (Tailscale, a reverse proxy subpath)

Juuku works mounted at `/juuku` instead of the root. `tailscale serve` can mount a
path to the container port and strips it before proxying, which is one way to put a
private URL in front of the app without a certificate of your own.

```sh
sudo tailscale serve --bg --set-path /juuku http://127.0.0.1:3101
# -> https://<machine>.<your-tailnet>.ts.net/juuku/
```

That works because the build is prefix-agnostic: `vite` emits relative asset URLs,
`index.html` links and `manifest.webmanifest` resolve against their own location,
and every API call is relative to the document rather than the host root. Nothing
in the server knows about the prefix — the proxy removes it. See
`docs/ARCHITECTURE.md` before adding an absolute URL back.

### Installing it as a PWA, and why HTTPS is worth it

Juuku ships a manifest and an `apple-touch-icon`, so **Share → Add to Home Screen**
in Safari gives you a standalone app with the record icon. That works over a plain
`http://` LAN address — nothing in the current app needs a secure context.

HTTPS does matter the moment you want more than that: service workers, push
notifications and the permission-gated APIs are only available in a
[secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)
(HTTPS, or `localhost`), and on iOS 16.4+ web push additionally requires the app to
be installed on the home screen. `tailscale serve` gives you a real certificate over
MagicDNS with nothing exposed to the public internet — tailnet only:

```sh
sudo tailscale serve --bg --set-path /juuku http://127.0.0.1:3101
# open https://<machine>.<your-tailnet>.ts.net/juuku/ in Safari, then Add to Home Screen
```

Do **not** reach for `tailscale funnel` for this: `serve` is tailnet-only, `funnel`
publishes to the internet, and there is no login in front of Juuku unless you set
`JUUKU_PASSWORD`.

## Pointing at another Navidrome (a real library)

Read-only is fine: a server with jukebox mode off answers 501 for `jukeboxControl`, and the app shows no queue instead of failing. Credentials stay out of git:

```sh
NAVIDROME_URL=http://navidrome.example.lan:4533 NAVIDROME_USER=juuku NAVIDROME_PASSWORD=… \
  ./scripts/remote-instance.sh 3102
```

Environment variables win over `.env`, so the sandbox on `:3100` keeps running
unchanged. Create the user once with `docker exec -it navidrome /app/navidrome user
create --username juuku` (there is no password flag — it prompts twice, so it needs a
TTY). Playback through a real server needs jukebox mode, `mpv` and an audio output on
that host first.

## The throwaway Navidrome

Never point development at your live instance. `docker-compose.yml` runs a separate Navidrome with jukebox enabled:

- container `juuku-navidrome`, project `juuku`
- `Jukebox.Enabled=true`, `MPVCmdTemplate` with `--ao=pulse` (real audio, see below)
- `Jukebox.AdminOnly=true`
- `mpv` is already inside the `navidrome/navidrome` image — nothing to install
- volumes: `juuku_navidrome-data` (`/data`) and `juuku_navidrome-music` (`/music`)

```sh
./scripts/sandbox-up.sh
```

The script starts the container, seeds the music volume from `sandbox/music` if empty, creates the first admin (`admin` / `juuku` by default, via `/auth/createAdmin` — that endpoint only exists while the user table is empty), and forces a scan.

`sandbox/music` is gitignored and starts empty: drop a few albums in it (any format
Navidrome reads) and re-run the script. `docker compose down -v` resets both volumes.

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

1. **Bind mounts can be unreadable inside the container.** Depending on the host's
   filesystem and user namespaces, even root in the container gets `Permission
   denied` on a bind mount while a named volume works fine. Hence music and data
   live in named volumes, seeded with `docker cp`, instead of a `./sandbox/music`
   mount.
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
