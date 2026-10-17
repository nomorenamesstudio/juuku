# Changelog

Newest first. Tags: **Feature**, **Fix**, **Break**.

## 2026-10-17

- **Feature** — project skeleton: Vite + React UI, Express API, `.mjs` Subsonic client (no build step). Config via `.env`.
- **Feature** — full jukebox control surface: `state` (queue + status in one call), `control` (`set`, `start`, `stop`, `skip` with offset, `add`, `clear`, `remove`, `shuffle`, `setGain`), library search, album browsing and a cover-art proxy.
- **Feature** — POC UI: now playing with live position, transport, volume, queue with per-row skip/remove, search-to-add and add-album. Polls once a second, pauses while the tab is hidden.
- **Feature** — throwaway Navidrome sandbox (`docker-compose.yml` + `scripts/sandbox-up.sh`): jukebox enabled, `mpv --ao=null`, 15 tracks seeded from two albums, admin bootstrapped, scan forced.
- **Feature** — docs set: INDEX, API, ARCHITECTURE, SETUP, CHANGELOG.

### Notes

- Behaviour verified against Navidrome 0.64.2: pause/play, skip with offset, gain, add, remove, shuffle all round-trip, and `position` advances in real time under `--ao=null`.
- Port 8080 is taken on this machine; the dev server sits on 3100 and the API on 3101.
- Music and data live in docker named volumes because container bind mounts from the workspace are unreadable here.
