# Security

Juuku is a remote for the machine that plays music. Whoever can reach it can
start, stop, skip and queue anything, change the volume, and edit the playlists
of the Navidrome account it is configured with. Treat it like the jukebox in the
room, not like a website.

## What it holds

| | |
|---|---|
| Navidrome credentials | in the environment (`NAVIDROME_*`), never in the image, never in the repo, never sent to the browser |
| Browser session | none — the browser talks only to Juuku's own API on the same origin |
| Outbound calls | Two, and only two: your Navidrome, and — at most once every six hours — GitHub's public API for the newest release tag. `JUUKU_UPDATE_CHECK=off` stops the second one. Nothing else leaves the box, and no request carries your credentials |
| On-disk state | three JSON files in the data volume: `prefs.json` (per-account preferences), `recent.json` (the albums that played) and `volume.json` (the last level set from the app). Nothing else, and the image itself writes nothing |

## The default posture

- **LAN only.** The compose file publishes the port on the LAN and nothing else.
  Do not forward it from your router.
- **No login unless you ask for one.** With `JUUKU_PASSWORD` unset the app has no
  authentication, on purpose: on a home network it is the remote for the room.
  Set the variable and every `/api` route needs a session — a 30-day HttpOnly,
  SameSite=Lax cookie signed with a key derived from that password, with a
  timing-safe compare on sign-in and per-address throttling of failures. That
  trade only holds while the port stays private either way.
- **`X-Forwarded-For` is not trusted by default.** The throttle counts failures per
  address, and that address is the socket's unless `JUUKU_TRUST_PROXY` names the
  proxy in front (a hop count like `1`, or `loopback`). Left on with nothing in
  front, a client could send a fake header on every attempt and never be counted.
- **Dedicated Navidrome user, ideally not an admin.** Navidrome defaults
  `Jukebox.AdminOnly` to true and refuses non-admins with `Jukebox is admin only
  (code 50)`. Set `ND_JUKEBOX_ADMINONLY=false` and give Juuku a plain account —
  that is the least privilege that works. If you would rather not touch that
  setting, the account has to be an admin, which means the password in the
  deployment environment is effectively a Navidrome admin credential: keep it
  dedicated, strong, and never the same as your own login.
- **No secrets in git.** Only `deploy/.env.example` with placeholder values is
  tracked; `.env`, `.env.remote` and `.git-token` are ignored, and `.dockerignore`
  keeps them out of build contexts too.
- **Non-root, read-only, no capabilities.** The image runs as uid 1000 with
  `cap_drop: ALL`, `no-new-privileges` and a read-only root filesystem. The writable
  paths are the `./data` and `./mpv-sockets` volumes, which have to be owned by that
  uid: `mkdir -p data mpv-sockets && chown 1000:1000 data mpv-sockets`. Quitting a
  player Navidrome lost track of works through that shared directory and a matching
  uid, not through privileges — an earlier version of these docs asked for
  `user: "0:0"` and it is not needed.

## If it has to be reachable from outside

Put a reverse proxy in front and let the proxy do the authentication. The app
speaks plain HTTP and expects the proxy to terminate TLS.

```caddy
jukebox.example.com {
    basic_auth {
        you $2a$14$…   # caddy hash-password
    }
    reverse_proxy 10.0.0.10:3101
}
```

A tunnel (Tailscale, WireGuard) is a better answer than exposing a port at all:
it gives you the app from anywhere without publishing anything.

## Known gaps, stated plainly

- **Auth is one shared password, not accounts.** Everyone with it is the same
  user; there is no per-person revocation short of changing the password.
- **No CSRF token.** Every write is a `POST`/`DELETE` on the same origin and the
  session cookie is `SameSite=Lax`, and every write is required to carry an
  `application/json` content type — which a cross-site form cannot send, so the
  classic attack is covered. A proxy that rewrites content could still break that
  assumption.
- **Rate limiting covers sign-in only** (8 failures per address per 10 minutes,
  in memory, so it resets on restart). The rest of the API has none: fine on a
  LAN, not fine on the open internet.
- **The Navidrome password is in the environment**, so it is visible to anyone
  who can `docker inspect` on the host. A password file
  (`NAVIDROME_PASSWORD_FILE`) is not implemented yet.
- Reachability aside, the API trusts whatever song and playlist ids it is given
  and passes them to Navidrome — no shell, no SQL, no filesystem path involved.

## Reporting

Open an issue, or mail the address in the commit history.
