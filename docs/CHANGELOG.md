# Changelog

Newest first. Tags: **Feature**, **Fix**, **Break**.

## 2026-10-17

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
