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
| `JUUKU_TRUST_PROXY` | only when a proxy is in front: a hop count (`1`) or `loopback`. See below |
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
the host `audio` group via `group_add`. `Jukebox.Default` is a *symbolic* name from
`Jukebox.Devices`, which cannot be set from the environment, so it stays `auto`.

**Pin the output anyway.** Navidrome runs one `mpv` per track through a template,
and the default is `mpv --audio-device=%d …` with `%d` = `auto` — ALSA then picks,
and on a box with more than one card it can land on an HDMI sink. An HDMI output
that is off or renegotiating blocks `mpv` inside an audio write: the process stays
alive, its IPC socket stops answering, and because Navidrome's client has no read
deadline every `jukeboxControl` call hangs until Navidrome restarts (the API then
looks "unreachable" while plain endpoints like `ping` stay fast). Pin the device in
the template instead:

```yaml
# amend to your device; list them with:
#   docker run --rm --device /dev/snd --entrypoint mpv <image> --audio-device=help
- ND_MPVCMDTEMPLATE=mpv --audio-device=alsa/default:CARD=YOURDAC --no-audio-display %f --input-ipc-server=%s
```

If a player is already wedged, `docker exec navidrome kill -9 <mpv pid>` and clear
`/tmp/mpv-ctrl-*.socket`; that drops the queue, so re-queue and start again.

If Navidrome runs in another compose stack, attach Juuku to that stack's network
and use the service name as the host (`http://navidrome:4533`); the commented
`networks:` block in `deploy/compose.yml` is that case. A Navidrome on another
host is just its LAN address.

Tagged releases publish a multi-arch image (amd64 + arm64, so a Raspberry Pi or an
ARM server pulls natively):

```sh
docker pull ghcr.io/nomorenamesstudio/juuku:latest
```

### The kill switch, and why it needs a shared directory

Navidrome runs one `mpv` per track and cannot always reap the previous one: when its
socket write fails it drops the reference and the orphan keeps playing, which sounds
like two tracks at once. Navidrome gives every player an IPC socket, and `quit` on
that socket ends it — that is what the **Restart playback** button in Settings does:
clear the queue (Navidrome quits the player it knows about), quit whatever sockets
are left, then put the queue back and start again.

For that to work the sockets have to be visible from this container, and mpv creates
them `0600` under its own uid — so the two containers have to run as the **same** uid.
That is the whole trick, and it needs no privileges: 1000 is what both images use by
default, so name it explicitly on both and own the two directories with it.

```yaml
# navidrome
environment:
  - TMPDIR=/mpv-sockets
user: "1000:1000"
volumes:
  - ./mpv-sockets:/mpv-sockets
# juuku
environment:
  JUUKU_MPV_SOCKETS: /mpv-sockets
user: "1000:1000"
volumes:
  - ./mpv-sockets:/mpv-sockets
```

```sh
# once, next to the compose files, before the first start
mkdir -p data mpv-sockets && chown 1000:1000 data mpv-sockets
```

If your host user is not uid 1000, use that uid on both containers instead of 1000 —
the number matters only in that both sides agree. `deploy/compose.yml` already runs
juuku this way.

**Navidrome needs its audio access back too**, since root used to cover that as well.
If it plays into a USB DAC or a sound card (`--audio-device=alsa/default`, or a
`dmix` in `/etc/asound.conf`), give it the audio group — the `/dev/snd` nodes are
`root:audio`, so a plain uid cannot open them:

```yaml
# navidrome
user: "1000:1000"
group_add:
  - "29"          # the audio gid on the host: `getent group audio`
```

With `PULSE_SERVER`/`PIPEWIRE_REMOTE` pointing at a socket instead, that socket has
to be readable by that uid for the same reason.

Running juuku as root (`user: "0:0"`) also opens the sockets, and that is what this
page used to recommend. It works, and it costs nothing but a root process on a box
that only needs to read its own files — which is a bad default to hand a stranger who
copies the compose file, so it is gone. A root container here can overwrite anything
inside the two directories it mounts, whatever their owner.

Without the directory Settings shows `Players: not shared` and hides the button.

Share the directory but give the containers different uids and you get the worst of
both: the sockets are visible, mpv's files are not, and Settings says `0 running, 1
not reachable`. Juuku will not touch what it cannot open — deleting an unreachable
socket used to cut Navidrome's only handle on a live player, which is exactly how you
end up with two `mpv` processes playing over each other — but it also cannot quit it,
so match the uid or leave `JUUKU_MPV_SOCKETS` unset.

Preferences are kept per Navidrome account in one JSON file, so they survive a
redeploy and follow a person from phone to desktop: lyrics settings, the recent
search list, the library sort and the albums that played. Put a volume on
`JUUKU_DATA_DIR` (the shipped compose mounts `./data`) or the file goes away with
the container. The directory has to be writable by the user inside the container:
the image runs as `node` (uid 1000), so either `mkdir -p data && chown 1000:1000 data`
or run the service as the directory's owner with `user: "<uid>:<gid>"`. If it is not
writable the app still works — the API answers 500 on save and preferences simply
stay local to each browser. The store is `{"version":1,"profiles":{"<account>":{...}}}`, which
is also where per-account logins will land.

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

### Tell it that a proxy is there

`X-Forwarded-For` and `X-Forwarded-Proto` are **not trusted by default**, because
with nothing in front they are just headers the client typed, and trusting them lets
anyone hand the login throttle a fresh address per attempt. Behind a proxy the app
therefore needs to be told, or two things go wrong: the session cookie is issued
without `Secure` (the proxy terminated the TLS, the app cannot see it) and every
browser looks like the same address, so eight failed sign-ins from anywhere lock out
everyone.

```sh
# one proxy hop (Caddy, nginx, tailscale serve)
JUUKU_TRUST_PROXY=1
```

A hop count is right when exactly one proxy appends the header. `JUUKU_TRUST_PROXY=loopback`
trusts anything from 127.0.0.1 instead, which suits a proxy on the same host,
including `tailscale serve` pointing at `127.0.0.1:3101`.

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
