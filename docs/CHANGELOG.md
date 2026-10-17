# Changelog

Newest first. Tags: **Feature**, **Fix**, **Break**.

## 2026-10-17

- **Feature** — track actions sheet (⋯ on any row): play next, add to queue, add to a playlist, and remove when you are inside a playlist. "Play next" splices after the current track and resumes it — Subsonic's `set` restarts at index 0, so the endpoint re-skips to the current position first.
- **Feature** — playlists: list with covers and durations, create inline or from the sheet's picker, open one, play/queue the whole list, remove tracks. Everything is a Navidrome playlist, so other clients see them too.
- **Feature** — repeat mode (off / all / one), persisted in `localStorage` and toggled from the queue header and the player header. Subsonic has no repeat, so the client watches the poll: a finished queue reports `playing: false` with position back at 0, which is what separates it from a manual pause. Repeat-one has to follow Navidrome's auto-advance and jump back, so it can flash a fraction of a second of the next track.

- **Fix** — the library search field was 14.1 px, so iOS Safari zoomed the page when it got focus; it is 16 px on phones (desktop keeps 14.1) and `text-size-adjust` is pinned to 100%.

- **Feature** — artist rows show a round avatar: Navidrome already exposes artist art (`coverArt: ar-…` plus `artistImageUrl`) and the existing cover proxy serves it, so `/api/artists` and search results now pass `coverArt` through and the list renders a 44 px circle, falling back to an initial when an artist has none.

- **Change** — the phone player's header chevron is gone (the swipe and the grabber are the way out); the deck's chevron on desktop is now a real toggle: up = expand, down = collapse, and it no longer does nothing once the player is open.
- **Fix** — album actions moved out of the meta column: on the phone "Play album" and "Add to queue" were stacking inside a 217 px column, now they sit on one row under the hero.

- **Change** — the player's mic and favourite buttons sit in the transport row now (mic · prev · play · next · heart) instead of the header, which leaves the header with the close control and the track counter. Lyrics mode keeps just the mic and the heart so there is still a way back to the cover.
- **Fix** — the toast sits above the header on the phone's player sheet; it used to land on the transport because that sheet has no deck under it.

- **Fix** — the wordmark was 1.28 rem on the phone while the refresh button took 40 px, so the button dominated the header; it is 1.6 rem now (the rail's size) with an 8 px status dot.
- **Fix** — removed a second stray copy of the `.wordmark` / `.led` rules that was hiding inside the now-bar section (the earlier dedupe covered only the views/albums/rows block).

- **Feature** — motion pass, all CSS: one easing/duration scale, route views fade-and-lift in, the deck and the player sheet rise into place, buttons and album covers press in, the queue badge pops when the count changes. Everything collapses to 0.001 s under `prefers-reduced-motion`.
- **Feature** — pull the phone player down to close it: the sheet follows the finger, snaps back under 110 px, closes past it or on a fast flick, with a grabber pill at the top. Verified with real CDP touch events (216 px mid-drag → closed to the album route).
- **Fix** — the first swipe attempt did nothing because dragging the artwork started a native image drag, which fires `pointercancel` and killed the gesture: images are no longer draggable and the sheet uses `touch-action: none` while the lyrics pane keeps `pan-y`.
- **Fix** — closing a deep-linked player now falls back to the library (`goBack`) instead of calling `history.back()` with nowhere to go.

- **Fix** — every icon is now lucide (`lucide-react`, ISC): the previous set was hand-drawn and each glyph had its own drawing weight, so the volume, queue, heart and refresh icons never lined up no matter what size they were given. One 24 px grid, 1.75 stroke, one wrapper in `src/icons.tsx`.
- **Fix** — the refresh button was a custom arc that sat off-centre; it is now lucide `RotateCw`.
- **Fix** — sizes are optical, not just numeric: mic-vocal fills its box, so it is 16 next to an 18 heart. Scale documented in `src/icons.tsx` (16 / 18 / 20 / 22 / 26).

- **Fix** — one icon size scale instead of eleven: 14 meta, 16 row actions, 18 controls, 20 header actions / deck play, 22 big transport, 26 big play. The mic drops to 18 so it stops out-weighing the 20 px heart, and the phone header's `↻` character is a real `RefreshIcon` at 20 (it was a 15 px glyph in a 42 px button).
- **Fix** — control boxes are 40 px (44 on coarse pointers) and radii collapse to 8 / 10 / 12 / 16 / pill instead of eight ad-hoc values.
- **Fix** — type scale trimmed from 20 distinct sizes to seven (0.68 / 0.72 / 0.75 / 0.8 / 0.86 / 0.94 / 1) plus the display sizes.
- **Fix** — removed 426 lines of duplicated CSS (views, albums, rows and equalizer were each defined twice); verified a byte-identical screenshot before and after.

- **Change** — phone mini player reads as one block again: 10 px radius (was 15) and 11 px of air between the content row and the progress line. The duplicate `margin: 0` left over from the absolute-positioned version was cancelling the new gap.

- **Change** — lyrics glyph is the vocal mic (`mic-vocal` from lucide, ISC, path credited in `src/icons.tsx`), not a talk mic.
- **Change** — the phone mini player's progress line moved below the content row, inside the bar's rounded corners, with a visible unfilled track; the desktop deck keeps its full-width line on top.

- **Change** — lyrics toggle uses a microphone icon.
- **Fix** — the phone mini player's progress line looked broken because it sat on the bar's rounded top edge and its thumb was invisible until hover (which never happens on touch): the bar is taller, the line is inset 14 px inside the rounded corner, shows a clear unfilled track, and is no longer a control on phones (seeking lives in the open player; the deck scrubber stays interactive on desktop).
- **Fix** — the queue count badge overlapped the tab icon; it now sits clear of it with a background ring.
- **Feature** — the album name in the player links to that album in the library.

- **Feature** — the year sits next to the album title (album page) and after the album name in the player; artist names in both are links to the artist page.
- **Change** — shuffle lives on the queue page only; the player transport and the deck drop it. The phone's transport is now prev / play / next, centred, and the lyrics toggle moved into the player header.
- **Change** — the phone mini player no longer carries a queue button (the tab bar has one), so it is artwork, title and the two transport buttons.
- **Fix** — a stray `.icon-button { margin-left: auto }` rule pushed every icon button right inside flex rows, which is why mobile transport/header elements looked misaligned: the mobile transport sat at 85/163/331 px instead of a centred, evenly gapped group. Removed; the phone transport is now 85/163/263 with equal 36 px gaps and the header controls line up with the page edges.

- **Feature** — on phones the full-screen player's lyrics mode now keeps the app chrome: lyrics fill the screen with the mini player and the tab bar underneath, and tapping the mini player drops back to the cover. Playback (play/pause, next, queue, seek from the bar) stays reachable while reading. The big transport, scrubber and volume hide in that mode so nothing is duplicated.

- **Fix** — the deck volume slider overlapped the queue button in Firefox: a range input will not shrink below its intrinsic width, so it grew past its 150 px container. The input is now `flex: 1 1 0` with `min-width: 0`, and the right cluster gap is 0.8 rem — volume→queue sits at a constant 12 px from 900 to 1440 px wide, identical in Chromium and Firefox.

- **Fix** — Firefox rendered the deck volume slider as a floating dot: the input was `appearance: none` with only `::-webkit-slider-*` rules, so it had no track. Added `::-moz-range-track/-progress/-thumb`; verified in Playwright Firefox (drag to 30% → gain 0.29).
- **Feature** — the deck's progress line is now the scrubber (click or drag to seek), so the open player no longer needs its own transport.
- **Change** — desktop open player is cover, title and lyrics only; transport, scrubber, volume and close button live in the deck (phones keep the full-screen player with its own controls). The queue stays one click away in the deck.

- **Fix** — the desktop player page was taller than the viewport (1001 px in a 900 px window), so the volume row sat below the fold and the page scrolled; it is now exactly `100dvh - 86px`, and its own volume row is dropped on desktop because the deck carries one.
- **Fix** — the footer transport was off-centre: with `expand` pulled out of the middle group, the play button sat beside the centre line. The deck is now prev / play / next centred (718 px of a 720 px midpoint), with favourite, shuffle, volume, queue and expand in the right cluster.
- **Fix** — the deck disappeared on the player page; it now stays on every desktop route (phones still give the full-screen player the whole screen).
- **Fix** — the player column was wider than the artwork, so the scrubber and title hung past the cover; the grid track is now `min(380px, 40vh)` and everything shares the artwork's edges.

- **Feature** — wide-screen layout worth using: full-width transport deck at the bottom (artwork, favorite, centred transport, volume, queue, expand), sidebar rail, 1200px content, larger album grid, and album pages laid out as a table with a header row instead of a phone-style list.
- **Feature** — the player is two-column on desktop: artwork and controls on the left, sticky synced-lyrics pane on the right (mobile keeps the art/lyrics toggle).
- **Fix** — the wide-screen transport buttons no longer leak into the phone mini player (`.bar-only` lost the cascade to `.icon-button`).
- **Feature** — the UI is now a music player rather than a single control panel: routes for library, album, artist, favorites, queue and a full-screen player that minimizes to a bottom bar (mobile tab bar + desktop sidebar).
- **Feature** — library browser: paged album grid, artist list, and one search over songs, albums and artists. Row tap queues a track, ▶ plays it now, heart favorites it.
- **Feature** — queue as its own view: skip to an entry, remove a track, shuffle, clear. Clear is the "reset" the brief asked for.
- **Feature** — favorites via a lazily created `Favorites` playlist in Navidrome (deduped add, index-resolved remove), with a `POST /api/play` endpoint for play-album/play-all.
- **Feature** — lyrics view in the player: synced lines from the embedded LRC tags through `getLyricsBySongId`, LRCLIB fallback for tracks that have none (verified: Röyksopp "Sayit" resolved via LRCLIB), cached 24 h including misses.
- **Feature** — design pass: Bricolage Grotesque + Instrument Serif (SIL OFL, self-hosted), warm dark jukebox palette, amber accent, artwork-forward album and player views, reduced-motion support.

- **Fix** — volume slider no longer fights the 1s poll: the thumb holds a local draft while dragging, `setGain` is debounced 150 ms and applied from its own response, keyboard changes now commit too (previously only `pointerup` did), and the track/thumb are bigger with `touch-action: none`.
- **Fix** — mobile layout: smaller cover art, volume on its own row, 44 px touch targets, and the queue scrolls inside its panel (with a fade) instead of pushing the library off the page.
- **Feature** — jukebox audio actually plays on the dev machine's speakers: `scripts/audio-dev.sh` exposes PulseAudio on the docker bridge (`172.17.0.1:4713`) and recreates the container with `PULSE_SERVER` + `mpv --ao=pulse`. Verified: mpv streams at 44.1 kHz into the default sink and `position` advances in real time.

- **Feature** — project skeleton: Vite + React UI, Express API, `.mjs` Subsonic client (no build step). Config via `.env`.
- **Feature** — full jukebox control surface: `state` (queue + status in one call), `control` (`set`, `start`, `stop`, `skip` with offset, `add`, `clear`, `remove`, `shuffle`, `setGain`), library search, album browsing and a cover-art proxy.
- **Feature** — POC UI: now playing with live position, transport, volume, queue with per-row skip/remove, search-to-add and add-album. Polls once a second, pauses while the tab is hidden.
- **Feature** — throwaway Navidrome sandbox (`docker-compose.yml` + `scripts/sandbox-up.sh`): jukebox enabled, `mpv --ao=null`, 15 tracks seeded from two albums, admin bootstrapped, scan forced.
- **Feature** — docs set: INDEX, API, ARCHITECTURE, SETUP, CHANGELOG.

### Notes

- Behaviour verified against Navidrome 0.64.2: pause/play, skip with offset, gain, add, remove, shuffle all round-trip, and `position` advances in real time under `--ao=null`.
- Port 8080 is taken on this machine; the dev server sits on 3100 and the API on 3101.
- Music and data live in docker named volumes because container bind mounts from the workspace are unreadable here.
