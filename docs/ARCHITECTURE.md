# Architecture

```
browser (React, polls 1/s)
   │  JSON over /api
   ▼
Juuku API (Node/Express, :3101)   ← holds the Subsonic credentials
   │  Subsonic REST + salted token
   ▼
Navidrome (:4533)  ── IPC ──▶  mpv  ──▶  speakers on the Navidrome host
```

Navidrome's jukebox is not exposed by its own web UI. The only interface is Subsonic's `jukeboxControl`, and it is a **poll-and-command** API: there is no event stream, no websocket, no long-poll. That single fact shapes the whole design.

## Sorting

Two album orders are juuku's own, not Navidrome's: `alphabeticalByName` and
`alphabeticalByArtist`. `server/sort.mjs` builds the key from the first letter or
digit, folding accents, so leading quotes, ellipses and brackets do not decide the
order (`“Heroes”` is an H, `...I Care Because You Do` an I) and a symbols-only name
keys to empty and stays in front. Because that cannot be expressed in a Subsonic
filter, `/api/albums` fetches the whole list in pages of 500, sorts it and slices
(the result is cached for five minutes); `/api/artists` sorts its single response
the same way.

## Controls

Every standalone control — search field, create-playlist capsule, the browse
switch, the sort dropdown — is built from `--field-h` (3rem), `--field-bg`,
`--field-radius` and `--field-font` (1rem, so iOS never zooms on focus). They, the
section labels and the rows all start on the same content edge: the head carries no
horizontal padding of its own.

## Home

`/` is a set of horizontally scrolling shelves, ten albums each: last played, last
added, newest release, daily picks, then a row of ten daily artists. Each shelf's
"See all" writes the matching library sort and goes to `/library/albums` (artists
go to `/library/artists`), which is why `daily` exists as a sort type.

"Last played" is juuku's own log: Navidrome never stores jukebox playback, so the
server notes the album that was playing when the queue moves on and keeps the last
forty album ids and twelve played playlists (id *and* name, so a playlist the importer
recreated under a new id does not fall off the row) in `recent.json` in the data dir — a
restart would otherwise wipe the row.
The two daily rows are the whole library shuffled with a mulberry32 seeded from the
local date the client sends, so they hold still all day and differ between devices
only if the devices disagree about the date.

## Themes

One attribute on `<html>`, `data-theme="mocha|modern|geek"`, set from
`localStorage` before React renders (`src/theme.ts`). Every colour, corner radius,
display face, lyric face and the cover-glow strength is a CSS custom property in
`styles.css`; a theme block only overrides those, and derived tints use
`color-mix()` of `--accent` / `--bg` / `--line` / `--text` so nothing is left
painted in the mocha palette. Adding a fourth theme is one block of variables plus
an entry in `THEMES`. Icons follow the same switch: `src/icons.tsx` wraps each lucide
glyph and, in geek, renders its `src/pixel-icons.tsx` counterpart — both read the
theme from the subscription in `theme.ts`, so components never pass a theme down.

## Decisions

**The server owns the credentials.** The browser could call Subsonic directly, but then the Navidrome password would live in the page and CORS would have to be opened on the Navidrome instance. A thin proxy keeps both problems away and gives one place to add auth later, when this is not just a LAN toy.

**One poll target.** `/api/state` returns queue *and* status from a single `jukeboxControl?action=get` call, because Navidrome's `get` already embeds `jukeboxStatus`. One request per second, ~15 entries of JSON, cached for 900 ms on the server and shared between devices. The UI pauses polling while the tab is hidden and never lets two polls overlap — a stuck player takes up to ten seconds, and the ticks used to stack up behind it.

**Progress needs the queue.** Subsonic's status has `position` but no `duration`, so the progress bar divides the position by the duration of the entry at `currentIndex`.

**No optimistic status.** Control actions return the authoritative status, and the UI then refetches state. Both round trips are local, so this is cheaper than reconciling optimistic state that mpv may not honour (a `skip` past the end is clamped, for example).

**The UI is a player, not a control panel.** Eleven hash routes — `#/home`, `#/library/{albums,artists,playlists}`, `#/album/:id`, `#/artist/:id`, `#/playlist/:id`, `#/favorites`, `#/queue`, `#/search`, `#/settings` — plus a full-screen `#/player` that collapses into a fixed mini player. Routes are hash-based so the phone's back gesture closes what it should, and the mini player is the only chrome that is always there. The queue is a view, not a permanent column.

**Motion is CSS-only and short.** Two durations and one spring easing on `:root`; entrances are keyframes on the view, the deck and the player's inner shell, everything else is a transition on hover/active. The player sheet is the one place with gesture code: a pointer handler tracks vertical travel and sets a transform, so the gesture cannot fight the CSS animation (the animation lives on the inner shell, the transform on the outer element). `prefers-reduced-motion` flattens all of it.

**One component set, two layouts.** The shell is the same markup at every size: the rail and the bottom transport deck appear at ≥900px, the tab bar and compact mini player below it, and `.bar-only` elements (favorite, shuffle, previous, volume, expand) only render on the wide bar. Views stay list-and-grid on phones and become tables with header rows where the width pays for it — that is CSS, not a second component tree.

**Favorites are a Navidrome playlist, not the star flag.** Subsonic `star` is the lighter mechanism, but the brief asked for a favorites *playlist* — one that other clients and the server's own UI can see and play. So the API creates `Favorites` lazily, dedupes on add, and resolves removals to a playlist index. Cost: a favourite is a playlist write, and the client has to hold the playlist to know which hearts are filled.

**Lyrics come from the server's own pipeline first.** Navidrome already reads embedded `LYRICS` tags and `.lrc` sidecars and exposes them through OpenSubsonic `getLyricsBySongId`; the sandbox tracks arrive with LRC timestamps, so sync is real, not guessed. Tracks without any get one LRCLIB lookup keyed by artist/title/album/duration, cached for a day — including the misses, so the API never retries in a loop.

**`set` vs `clear` + `add`.** `set` replaces the queue without interrupting the current track; `clear` empties it. The UI uses `remove` for single rows and leaves `set` for later (e.g. drag-reorder, save/restore a party queue).

**Audio output is the host's problem, not the app's.** `MPVCmdTemplate` decides where sound goes — a real device, `--ao=null`, or a Snapcast FIFO. Navidrome only cares that mpv answers on its IPC socket. The sandbox plays into the host's PipeWire over a TCP bridge
(`scripts/audio-dev.sh`), because the container cannot reach the host's audio socket
directly. On a host with a real sound card the equivalent is mapping `/dev/snd` into
the container and using `--ao=alsa`, or the same bridge where PipeWire is present.

## Consequences to remember

- Volume is `gain` (0–1, mpv software volume), not a device mixer, so loudness is relative.
- One queue for everyone: two phones controlling at once are fighting over the same playlist. Guest queueing needs product decisions (voting, rate limits), not more API.
- `AdminOnly` is a Navidrome-side switch. A guest-friendly mode means `ND_JUKEBOX_ADMINONLY=false` and Navidrome users flagged for jukebox, not a Juuku concept.
- Polling at 1s means up to a second of lag on a second phone's view; acceptable for control, would not be for synchronized lyrics — the lyrics highlight is driven by the same 1s status, so it can be a beat behind.
- Seeking is `skip` with `index = currentIndex` and an `offset`, because Subsonic has no seek endpoint. It restarts the track at that position rather than scrubbing the existing stream, which is invisible on the server but does reset mpv's buffer.
- The favorites playlist is a shared, append-only list: two phones favoriting at once is last-write-wins on the read side, but dedupe keeps it from growing duplicates.

## Brand assets

`public/icon.svg` is the app icon (record, amber label, LED); its PNG set is
rendered from it at 180/192/512/1024 plus a maskable variant.

The wordmark itself is CSS, not an image: Instrument Serif for `juuku`, a 2.3 KB
self-hosted Noto Sans JP subset for `ジューク` (`public/fonts/noto-sans-jp-kana.woff2`,
OFL, because system fallbacks gave a different face on every device), and the LED
dot. Anything that needs it bigger — the README hero — clones that markup and
scales it with a transform, rather than redrawing it: an outline export cannot
reproduce the browser's kerning and drifted by a few percent on the kana.

## URLs are relative on purpose

The app is served at `/` on the LAN, and can be mounted at `/juuku` behind something
like `tailscale serve`, which strips the mount path before proxying.
Everything on the client side is therefore relative:

- `vite` builds with `base: './'` (dev keeps `/`), so assets are `./assets/…`
- `index.html` links and `manifest.webmanifest` (`start_url`, `scope`, icons) are
  relative, so the manifest resolves next to itself
- API calls go to `api/…`, not `/api/…`, and are resolved against the document

One absolute URL anywhere breaks the prefixed deployment while still working on the
LAN, which makes it an easy mistake to ship.

## Navigation and back

Hash routes, one `useRoute()` subscription in `App`, and a back link in each detail
view. The link is labelled with where it actually goes, so the router keeps its own
stack of visited routes: a hash change pushes, and a change that lands on the entry
below the top pops (that is a back). The browser's history cannot be read, and
`history.back()` is only used when the app already navigated — otherwise a deep
link's back button would leave the site.

Phones also get an edge-swipe: a pointer drag that starts within 26px of the left
edge, travels 90px horizontally, and is ignored when it looks vertical so the
player's pull-to-dismiss keeps working.

## Safe areas and the player's height

The player is the one view that has to fit the screen exactly, and the status bar is
handled by the page, not by the player: `.page` pads itself with
`env(safe-area-inset-top)` and the player's height is
`calc(100dvh - env(safe-area-inset-top))`. Using plain `100dvh` there made the player
hang one status bar below the screen in the installed app, which silently ate the
bottom padding — the same CSS measured fine in Safari (inset 0) and hugged the home
gesture in the PWA (inset 59px).

`env(safe-area-inset-bottom)` is 0 in Safari and ~34px installed, so any spacing that
has to clear the home indicator uses `max(3rem, … + env(safe-area-inset-bottom))`
rather than the inset alone.

The SPA shell is served with `Cache-Control: no-cache` and hashed assets `immutable`:
without that, an installed app keeps launching a cached `index.html` and none of the
CSS above ever reaches the phone.

### The status-bar surface (iOS standalone only)

iOS 27 washes out and blurs the top of an installed web app when it does not find a
full-width fixed surface at the screen edge — WebKit samples the edge for a
background thicker than ~10px and blurs what is underneath instead. `index.html`
carries an empty `.status-bar-surface` outside the app root for exactly that: 11px
tall, viewport-fixed, full width, inheriting the page colour, with its background
clipped to empty text so it paints nothing visible. It is `pointer-events: none`,
`aria-hidden`, and enabled only under `display-mode: standalone` on WebKit. It must
not be hidden with `opacity: 0` or `visibility: hidden` — that removes the background
the sampler is looking for. Prior art: nanobot#5942.
