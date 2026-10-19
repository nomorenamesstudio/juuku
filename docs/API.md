# API

Juuku exposes a small JSON API on `:3101`. The browser never talks to Navidrome directly — the server holds the credentials and translates to Subsonic.

All responses are JSON except `/api/cover/:id` (image bytes). Errors are `{ "error": "message" }` with `400` (bad request), `401` (Navidrome rejected the credentials), `502` (Navidrome unreachable or refused) or `500`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Connection + capability probe (does the instance have jukebox on?) |
| GET | `/api/state` | Whole remote state: queue plus playback status |
| POST | `/api/control` | Every write action |
| POST | `/api/play` | Replace the queue with these songs and start playing |
| POST | `/api/queue/next` | Insert songs right after the track that is playing |
| GET/POST | `/api/playlists` | List playlists / create one (`{ name, ids? }`) |
| GET | `/api/playlists/:id` | Playlist plus its songs |
| POST | `/api/playlists/:id/songs` | Append songs to a playlist |
| DELETE | `/api/playlists/:id/songs/:songId` | Remove one song from a playlist |
| GET | `/api/search?q=` | Songs + albums + artists in one call |
| GET | `/api/home?day=YYYY-MM-DD` | The four album shelves plus the daily artists for the given local day |
| GET | `/api/counts` | Totals for the tab pills: `{ albums, playlists }` |
| GET | `/api/albums?type=newest&size=30&offset=0&day=` | Album list, paged (`newest`, `recent`, `byYear`, `alphabeticalByName`, `alphabeticalByArtist`, `daily`) |
| GET | `/api/albums/:id` | Album plus its songs |
| GET | `/api/artists` | All artists |
| GET | `/api/artists/:id` | Artist plus their albums |
| GET | `/api/prefs` | This account's preferences (lyrics settings, recent searches, library sort) |
| PUT | `/api/prefs` | Merge preferences; unknown keys and wrong shapes are dropped |
| GET | `/api/lyrics/:id` | Synced or plain lyrics for a song |
| GET | `/api/favorites` | The `Favorites` playlist as songs |
| POST | `/api/favorites` | Add songs to it (`{ ids: string[] }`, deduped) |
| DELETE | `/api/favorites/:songId` | Remove one song from it |
| GET | `/api/cover/:id?size=300` | Cover art proxy (cached a day) |

### `GET /api/home?day=YYYY-MM-DD`

```json
{
  "lastPlayed": [ … albums … ],
  "lastAdded": [ … ],
  "newestRelease": [ … ],
  "dailyPicks": [ … ],
  "dailyArtists": [ … artists … ]
}
```

Ten each, at most. `lastPlayed` comes from juuku's own log (`recent.json` in the data dir) because Navidrome does not record jukebox playback; `dailyPicks` and `dailyArtists` are the whole library shuffled with a seed derived from `day`, so the order is stable for that day and changes at midnight. `dailyArtists` leaves out the `Various Artists` catch-all.

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

### `POST /api/play`

`{ "ids": ["…"] }` — `set` + `skip` to index 0 + `start`, in that order, returning the new status. One call so the UI cannot leave the jukebox in a half-changed state.

### `POST /api/queue/next`

`{ "ids": ["…"] }` — splices the songs in after the current index. Subsonic only has append and replace, and Navidrome's `set` **restarts at index 0 and stops**, so the endpoint re-skips to the current track with the offset it had reached and resumes if it was playing. Verified: queue `[A,B,C]` playing B → `[A,B,X,C]`, still playing B, position continuing.

### `GET /api/lyrics/:id`

```json
{ "source": "navidrome", "synced": true, "lines": [{ "time": 50560, "text": "We are human" }] }
```

`source` is `navidrome` (embedded tag or `.lrc` sidecar, via OpenSubsonic `getLyricsBySongId`), `lrclib` (opt-in lookup by artist/title/album/duration, `?lookup=1`), or `none`. Without `lookup=1` a file that carries no lyrics returns `none` — the lookup guesses, so it is a per-device setting (off by default). Titles that name another version — a bracketed or dashed `remix`, `edit`, `live`, `acoustic`, `instrumental`, `version` and the like — are never looked up: LRCLIB files the original's words under those titles, and a remix runs on a different timeline. Embedded lyrics are still served for them. `time` is milliseconds from the start of the track and is absent for unsynced lyrics. Both outcomes are cached for a day, misses included, so a lyrics-less track does not hammer LRCLIB.

### `GET/POST/DELETE /api/favorites`

The playlist is created lazily on the first favorite and named `Favorites`; the API dedupes on add and removes by song id (resolving the playlist index server-side). Responses are always the whole playlist: `{ playlistId, songs }`.

## Upstream mapping

Everything maps 1:1 onto Subsonic's only jukebox endpoint, `GET /rest/jukeboxControl`, with `action` plus the same parameter names. Two Navidrome-specific notes:

- Jukebox must be enabled on the server (`Jukebox.Enabled`) or every call fails with "Jukebox is disabled".
- With `Jukebox.AdminOnly` (the default) only admin users may control it. Otherwise Navidrome refuses with "Jukebox is admin only".
- Only one playback device exists in practice: `GetDeviceForUser` always returns the default device, so a queue is global, not per user.

Also used: `ping` (health), `search3` (search), `getAlbumList2` / `getAlbum` / `getArtists` / `getArtist` (library browsing), `getCoverArt` (art proxy), `getLyricsBySongId` (lyrics), `createPlaylist` / `updatePlaylist` / `getPlaylists` / `getPlaylist` (favorites).
