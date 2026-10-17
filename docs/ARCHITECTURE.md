# Architecture

```
browser (React, polls 1/s)
   │  JSON over /api
   ▼
Juicebox API (Node/Express, :3101)   ← holds the Subsonic credentials
   │  Subsonic REST + salted token
   ▼
Navidrome (:4533)  ── IPC ──▶  mpv  ──▶  speakers on the Navidrome host
```

Navidrome's jukebox is not exposed by its own web UI. The only interface is Subsonic's `jukeboxControl`, and it is a **poll-and-command** API: there is no event stream, no websocket, no long-poll. That single fact shapes the whole design.

## Decisions

**The server owns the credentials.** The browser could call Subsonic directly, but then the Navidrome password would live in the page and CORS would have to be opened on the Navidrome instance. A thin proxy keeps both problems away and gives one place to add auth later, when this is not just a LAN toy.

**One poll target.** `/api/state` returns queue *and* status from a single `jukeboxControl?action=get` call, because Navidrome's `get` already embeds `jukeboxStatus`. One request per second, ~15 entries of JSON, no cache layer needed. The UI pauses polling while the tab is hidden.

**Progress needs the queue.** Subsonic's status has `position` but no `duration`, so the progress bar divides the position by the duration of the entry at `currentIndex`.

**No optimistic status.** Control actions return the authoritative status, and the UI then refetches state. Both round trips are local, so this is cheaper than reconciling optimistic state that mpv may not honour (a `skip` past the end is clamped, for example).

**The UI is a player, not a control panel.** Four routes (`#/library`, `#/album/:id`, `#/favorites`, `#/queue`) plus a full-screen `#/player` that collapses into a fixed mini player. Routes are hash-based so the phone's back gesture closes what it should, and the mini player is the only chrome that is always there. The queue is a view, not a permanent column.

**Motion is CSS-only and short.** Two durations and one spring easing on `:root`; entrances are keyframes on the view, the deck and the player's inner shell, everything else is a transition on hover/active. The player sheet is the one place with gesture code: a pointer handler tracks vertical travel and sets a transform, so the gesture cannot fight the CSS animation (the animation lives on the inner shell, the transform on the outer element). `prefers-reduced-motion` flattens all of it.

**One component set, two layouts.** The shell is the same markup at every size: the rail and the bottom transport deck appear at ≥900px, the tab bar and compact mini player below it, and `.bar-only` elements (favorite, shuffle, previous, volume, expand) only render on the wide bar. Views stay list-and-grid on phones and become tables with header rows where the width pays for it — that is CSS, not a second component tree.

**Favorites are a Navidrome playlist, not the star flag.** Subsonic `star` is the lighter mechanism, but the brief asked for a favorites *playlist* — one that other clients and the server's own UI can see and play. So the API creates `Favorites` lazily, dedupes on add, and resolves removals to a playlist index. Cost: a favourite is a playlist write, and the client has to hold the playlist to know which hearts are filled.

**Lyrics come from the server's own pipeline first.** Navidrome already reads embedded `LYRICS` tags and `.lrc` sidecars and exposes them through OpenSubsonic `getLyricsBySongId`; the sandbox tracks arrive with LRC timestamps, so sync is real, not guessed. Tracks without any get one LRCLIB lookup keyed by artist/title/album/duration, cached for a day — including the misses, so the API never retries in a loop.

**`set` vs `clear` + `add`.** `set` replaces the queue without interrupting the current track; `clear` empties it. The UI uses `remove` for single rows and leaves `set` for later (e.g. drag-reorder, save/restore a party queue).

**Audio output is the host's problem, not the app's.** `MPVCmdTemplate` decides where sound goes — a real device, `--ao=null`, or a Snapcast FIFO. Navidrome only cares that mpv answers on its IPC socket. Locally the sandbox plays into the host's PipeWire over a TCP bridge (`scripts/audio-dev.sh`), because the container cannot reach the host's audio socket directly. On the Pi the equivalent is `--device /dev/snd` plus `--ao=alsa`, or the same bridge when PipeWire is present.

## Consequences to remember

- Volume is `gain` (0–1, mpv software volume), not a device mixer, so loudness is relative.
- One queue for everyone: two phones controlling at once are fighting over the same playlist. Guest queueing needs product decisions (voting, rate limits), not more API.
- `AdminOnly` is a Navidrome-side switch. A guest-friendly mode means `ND_JUKEBOX_ADMINONLY=false` and Navidrome users flagged for jukebox, not a Juicebox concept.
- Polling at 1s means up to a second of lag on a second phone's view; acceptable for control, would not be for synchronized lyrics — the lyrics highlight is driven by the same 1s status, so it can be a beat behind.
- Seeking is `skip` with `index = currentIndex` and an `offset`, because Subsonic has no seek endpoint. It restarts the track at that position rather than scrubbing the existing stream, which is invisible on the server but does reset mpv's buffer.
- The favorites playlist is a shared, append-only list: two phones favoriting at once is last-write-wins on the read side, but dedupe keeps it from growing duplicates.
