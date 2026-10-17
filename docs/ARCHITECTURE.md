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

**`set` vs `clear` + `add`.** `set` replaces the queue without interrupting the current track; `clear` empties it. The UI uses `remove` for single rows and leaves `set` for later (e.g. drag-reorder, save/restore a party queue).

**Audio output is the host's problem, not the app's.** `MPVCmdTemplate` decides where sound goes — a real device, `--ao=null`, or a Snapcast FIFO. Navidrome only cares that mpv answers on its IPC socket. Locally the sandbox plays into the host's PipeWire over a TCP bridge (`scripts/audio-dev.sh`), because the container cannot reach the host's audio socket directly. On the Pi the equivalent is `--device /dev/snd` plus `--ao=alsa`, or the same bridge when PipeWire is present.

## Consequences to remember

- Volume is `gain` (0–1, mpv software volume), not a device mixer, so loudness is relative.
- One queue for everyone: two phones controlling at once are fighting over the same playlist. Guest queueing needs product decisions (voting, rate limits), not more API.
- `AdminOnly` is a Navidrome-side switch. A guest-friendly mode means `ND_JUKEBOX_ADMINONLY=false` and Navidrome users flagged for jukebox, not a Juicebox concept.
- Polling at 1s means up to a second of lag on a second phone's view; acceptable for control, would not be for synchronized lyrics.
