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
| On-disk state | none. The container filesystem can be read-only |

## The default posture

- **LAN only.** The compose file publishes the port on the LAN and nothing else.
  Do not forward it from your router.
- **No login.** The app ships without authentication on purpose: on a home
  network it is the remote for the room, and a login on every screen would be
  worse than the risk it removes. That trade holds *only* while the port stays
  private.
- **Dedicated Navidrome user.** Create a normal (non-admin) user for Juuku
  (`navidrome user create --username juuku`). It needs browse, play, playlist
  access — not admin, not another user's data.
- **No secrets in git.** Only `deploy/.env.example` with placeholder values is
  tracked; `.env`, `.env.remote` and `.git-token` are ignored, and `.dockerignore`
  keeps them out of build contexts too.
- **Non-root, read-only, no capabilities.** The image runs as uid 1000 with
  `cap_drop: ALL`, `no-new-privileges` and a read-only root filesystem.

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

- **There is no application-level login.** A reverse proxy is the supported way
  to protect it. Application auth (a shared password with a signed, HttpOnly
  session cookie) is the intended next step before this is recommended to
  strangers on the internet.
- **No CSRF token.** Every write is a `POST`/`DELETE` with a JSON body on the
  same origin; a cross-site form cannot send `application/json`, which is what
  keeps this safe today. Adding auth must keep it that way, or add a token.
- **No rate limiting.** Fine on a LAN, not fine on the open internet.
- **The Navidrome password is in the environment**, so it is visible to anyone
  who can `docker inspect` on the host. A password file
  (`NAVIDROME_PASSWORD_FILE`) is not implemented yet.
- Reachability aside, the API trusts whatever song and playlist ids it is given
  and passes them to Navidrome — no shell, no SQL, no filesystem path involved.

## Reporting

Open an issue, or mail the address in the commit history.
