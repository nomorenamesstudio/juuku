# Juuku — A Free, Open-Source Remote for Navidrome's Jukebox Mode

[![License: MIT](https://img.shields.io/badge/License-MIT-b45309?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-b45309?style=for-the-badge)](#contributing)
[![React 19](https://img.shields.io/badge/React-19-1f6feb?style=for-the-badge)](src/)
[![Node 22](https://img.shields.io/badge/Node-22-3fb950?style=for-the-badge)](server/)
[![Build](https://github.com/nomorenamesstudio/juuku/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/nomorenamesstudio/juuku/actions/workflows/test.yml)

![Juuku: the wordmark, the line “A free remote for Navidrome's jukebox mode”, and the player screen on a phone](docs/social/og-1200x630.jpg)

A free, open-source remote for [Navidrome](https://www.navidrome.org/)'s jukebox
mode that turns any browser on your network into the remote for the machine with the
speakers — and gives you a real library, queue and player instead of a raw Subsonic
endpoint.

*Juuku* (ジューク) is how Japanese shortens ジュークボックス, the jukebox.

## Why this exists

Navidrome can drive `mpv` on its own host, but its web UI has no way to reach that
feature: jukebox control only exists behind the Subsonic `jukeboxControl` endpoint. So
the music plays in the room and the only way to change it is to walk over to that
machine. Juuku is the remote that should have come in the box.

## What you get

| | |
|---|---|
| **Library** | Album grid with paging, artist list, one search across songs, albums and artists. Tapping a track queues it, ▶ plays it now. |
| **Player** | Full-screen player that minimizes to a bar: artwork, scrubber that seeks inside the track, transport, volume, favorite. |
| **Queue** | Its own view: skip to an entry, remove one, shuffle, clear the lot. It follows the playing track by itself. |
| **Favorites** | The heart writes to a `Favorites` playlist in Navidrome, so your other clients see the same list. |
| **Lyrics** | Synced from the track's embedded `.lrc`/`LYRICS` tag through Navidrome, falling back to [LRCLIB](https://lrclib.net/) when a track has none. |
| **Home** | What played last — albums and playlists — plus last added, newest release and daily picks you can re-roll, from your own library. |
| **Scrobbling** | Jukebox playback reaches Last.fm and ListenBrainz through Navidrome's own scrobbler, so the room's plays count too. No keys to paste here. |
| **Three themes** | Mocha (amber, serif), Modern (turquoise, sans) and Geek (green mono, pixel icons). Same layout, same data. |
| **Phone first** | Sidebar on a wide screen, tab bar on a phone, installs to the home screen as a PWA. |
| **One command** | A single Docker container, uid 1000, read-only root filesystem, no capabilities. |

![The album page on a wide screen, with the same screen on a phone beside it](docs/screenshot.jpg)

Three themes, one layout — Mocha, Modern and Geek differ in color, type and icons, not
in what they show:

![Mocha, Modern and Geek](docs/themes.jpg)

The same themes, the same screenshots and a short FAQ live on the landing page:
<https://juuku.nomorenames.studio> ([source](site/)).

## Quick start

1. Point one of these at your Navidrome:

```sh
docker run -d --name juuku -p 3101:3101 --read-only --cap-drop ALL \
  -e NAVIDROME_URL=http://navidrome:4533 -e NAVIDROME_USER=juuku \
  -e NAVIDROME_PASSWORD=… ghcr.io/nomorenamesstudio/juuku:latest
```

2. Open `http://<host>:3101` on your phone and queue something.

`deploy/compose.yml` is the fuller version (data volume, healthcheck,
`no-new-privileges`), and [docs/SETUP.md](docs/SETUP.md) covers the rest, including
[running it behind a path prefix](docs/SETUP.md#behind-a-path-prefix-tailscale-a-reverse-proxy-subpath).

### Two passwords, not interchangeable

| variable | what it is |
|---|---|
| `NAVIDROME_URL` | the Navidrome that plays the music, e.g. `http://navidrome:4533` |
| `NAVIDROME_USER` | the Navidrome account Juuku signs in as |
| `NAVIDROME_PASSWORD` | **that** account's password. Server-side only, never sent to the browser |
| `JUUKU_PASSWORD` | optional lock on Juuku itself. Unset means no login at all (the LAN default) |
| `JUUKU_TRUST_PROXY` | only behind a reverse proxy: a hop count (`1`) or `loopback` |

Navidrome defaults `Jukebox.AdminOnly` to true, so the Juuku account has to be an admin
unless you set `ND_JUKEBOX_ADMINONLY=false` on the Navidrome side. That trade, and the
rest of the threat model, is [SECURITY.md](SECURITY.md) — this is a remote for the
room, not a website.

### Good to know

- **HTTPS is only needed for the home-screen install.** Everything else works over
  plain HTTP; a tailnet with `tailscale serve` is the easy way to get it — see
  [docs/SETUP.md](docs/SETUP.md#installing-it-as-a-pwa-and-why-https-is-worth-it).
- **Your settings stay on your box:** three small JSON files in the data directory
  (preferences, the recent log, the last volume). Nothing leaves the network.
- **No Docker?** `npm install && npm run build && npm start` works too.
- **The UI talks to one small JSON API**, documented in [docs/API.md](docs/API.md).

## How it works

Your phone (or any browser on the network) talks to Juuku, Juuku talks to Navidrome,
and Navidrome plays the music through `mpv` on the machine with the speakers. The
Navidrome password stays on Juuku's server; the browser never sees it. There's one
queue for the room, because that's how Navidrome's jukebox works — and if a player
ever gets stuck, Settings → *Restart playback* cleans it up and rebuilds the queue.
The details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## FAQ

### Do I have to run another server?

A small container next to your Navidrome, on the same machine or the same network. No database, no cloud, no account.

### Why not just use Navidrome's own UI?

Jukebox control lives behind the Subsonic `jukeboxControl` endpoint, and Navidrome's player never calls it. Juuku does — and keeps the Navidrome password on the server, where the browser cannot see it.

### Who can queue songs?

Whoever can reach the port. Leave `JUUKU_PASSWORD` unset and that is your LAN; set it and everyone needs the password once, for 30 days. Either way the port stays private — no router forwarding.

### Does it need its own Navidrome account?

No — any account works, yours included. One catch: Navidrome refuses jukebox control from non-admins unless you set `ND_JUKEBOX_ADMINONLY=false` on the server. So either hand it an admin account, or flip that setting and use a normal one. A second account is tidier if you would rather not put your own password in a container, but it is optional.

### Why not a native app?

Building and shipping phone apps is more work: slower to iterate, two more codebases to keep alive, and the stores charge for it — Apple wants $99 a year before you ship anything. So no, not planned. If enough people chip in that developer fee though, it probably happens — and until then the web app does the job, especially installed as a PWA.

### Does it work on a phone?

It was built for the phone — that is the intended use — but it works flawlessly on anything with a browser; wide screens get a sidebar instead of the tab bar. It installs to a home screen as a PWA as well, which needs HTTPS: [that part of the setup docs](docs/SETUP.md#installing-it-as-a-pwa-and-why-https-is-worth-it) covers it.

### Why is it free?

Because we built it for ourselves. The remotes that existed were stale — the iOS ones especially — and the gap was annoying enough to fix. It came out fun, fun enough that someone else might get some use out of it. No account, no upsell, nothing to buy.

## Development

```sh
npm install
./scripts/sandbox-up.sh     # throwaway Navidrome on :4533 (albums from sandbox/music)
./scripts/audio-dev.sh      # jukebox audio -> your speakers
npm run dev                 # api :3101 + web :3100
```

Open <http://127.0.0.1:3100>. Drop a few albums into `sandbox/music` and re-run
`./scripts/sandbox-up.sh` if the sandbox is empty.

```
server/              API + Subsonic client (plain ESM Node, no build step)
src/                 React UI (Vite + TS): views/, rows, player, mini player
src/views/           Library, Album, Artist, Playlist, Queue, Favorites, Player, Settings
public/fonts/        Bricolage Grotesque, Instrument Serif, Geist Mono (SIL OFL)
sandbox/             throwaway music and data for the dev instance
scripts/             sandbox-up.sh, audio-dev.sh
docker-compose.yml   the throwaway Navidrome with jukebox enabled
docs/                INDEX, API, ARCHITECTURE, SETUP, CHANGELOG
site/                the landing page (GitHub Pages), static, no build step
```

## Docs

| | |
|---|---|
| [Setup](docs/SETUP.md) | sandbox, Docker, phone testing, credentials, traps |
| [Architecture](docs/ARCHITECTURE.md) | polling, repeat, the queue model, player healing |
| [API](docs/API.md) | the HTTP surface the UI talks to |
| [Security](SECURITY.md) | threat model, the no-login default, reverse-proxy recipe |
| [Changelog](docs/CHANGELOG.md) | dated entries, tagged Feature / Fix / Break |

## Contributing

1. Open an issue first for anything bigger than a typo, so we agree on the shape.
2. Fork, branch, and keep the change to the thing you named — this is a remote, not a
   media server.
3. Run `npm test` and `npm run build` before the PR. Plain-spoken review, no ceremony.

## License

MIT — see [LICENSE](LICENSE). Bundled assets keep their own licenses: Bricolage
Grotesque, Instrument Serif and Geist Mono are SIL OFL (licenses in `public/fonts/`),
the geek icons are [Pixelarticons](https://github.com/halfmage/pixelarticons) by Gerrit
Halfmann (MIT) and the modern icons are [Phosphor](https://phosphoricons.com) (MIT).

## Support

Free, MIT, no telemetry, no accounts. If Juuku earns a place in your setup, you can
[buy us a coffee](https://www.buymeacoffee.com/nomorenames).

[![GitHub stars](https://img.shields.io/github/stars/nomorenamesstudio/juuku?style=for-the-badge&color=b45309)](https://github.com/nomorenamesstudio/juuku/stargazers)

Made with ♥ by [No More Names Studio](https://nomorenames.studio)
