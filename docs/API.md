# API

Juicebox exposes a small JSON API on `:3101`. The browser never talks to Navidrome directly — the server holds the credentials and translates to Subsonic.

All responses are JSON except `/api/cover/:id` (image bytes). Errors are `{ "error": "message" }` with `400` (bad request), `401` (Navidrome rejected the credentials), `502` (Navidrome unreachable or refused) or `500`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Connection + capability probe (does the instance have jukebox on?) |
| GET | `/api/state` | Whole remote state: queue plus playback status |
| POST | `/api/control` | Every write action |
| GET | `/api/search?q=` | Song search |
| GET | `/api/albums?type=newest&size=30` | Album list (`newest`, `alphabeticalByName`, …) |
| GET | `/api/albums/:id` | Album plus its songs |
| GET | `/api/cover/:id?size=300` | Cover art proxy (cached a day) |

### `GET /api/health`

```json
{
  "ok": true,
  "url": "http://127.0.0.1:4533",
  "user": "admin",
  "navidrome": "0.64.2",
  "apiVersion": "1.16.1",
  "jukebox": { "currentIndex": 1, "playing": true, "gain": 0.4, "position": 93 }
}
```

`ok` is false and `jukebox` carries `{ "error": … }` when the server is up but jukebox mode is disabled.

### `GET /api/state`

One poll target, so the UI needs a single request per second:

```json
{
  "status": { "currentIndex": 1, "playing": true, "gain": 0.4, "position": 93 },
  "entries": [
    { "id": "…", "title": "Sayit", "artist": "Röyksopp & Robyn", "album": "Do It Again",
      "albumId": "…", "duration": 386, "track": 2, "coverArt": "…", "year": 2014 }
  ]
}
```

`currentIndex` is `-1` for an empty queue; `duration` comes from the queue entries and is what the progress bar divides by — Subsonic's status has a position but no duration.

### `POST /api/control`

Body: `{ action, index?, offset?, ids?, gain? }`, returns the new `status`.

| Action | Extra fields | Effect |
| --- | --- | --- |
| `set` | `ids: string[]` | Replace the queue without touching the playing track |
| `start` | — | Play |
| `stop` | — | Pause |
| `skip` | `index`, optional `offset` seconds | Jump to a queue index, optionally into the track |
| `add` | `ids: string[]` | Append songs |
| `clear` | — | Empty the queue |
| `remove` | `index` | Drop one entry |
| `shuffle` | — | Shuffle the queue |
| `setGain` | `gain` (0–1) | Volume |

`get` and `status` are reads and live behind `GET /api/state` and `/api/health` instead of the write endpoint.

## Upstream mapping

Everything maps 1:1 onto Subsonic's only jukebox endpoint, `GET /rest/jukeboxControl`, with `action` plus the same parameter names. Two Navidrome-specific notes:

- Jukebox must be enabled on the server (`Jukebox.Enabled`) or every call fails with "Jukebox is disabled".
- With `Jukebox.AdminOnly` (the default) only admin users may control it. Otherwise Navidrome refuses with "Jukebox is admin only".
- Only one playback device exists in practice: `GetDeviceForUser` always returns the default device, so a queue is global, not per user.

Also used: `ping` (health), `search3` (search), `getAlbumList2` / `getAlbum` (library browsing), `getCoverArt` (art proxy).
