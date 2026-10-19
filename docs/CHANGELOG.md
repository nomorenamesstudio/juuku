# Changelog

Newest first. Tags: **Feature**, **Fix**, **Break**.

## How versions are cut

`package.json` and the `v*` tag move together: a fix bumps the patch, a feature the
minor, and the tag is what CI builds the published image from.

## v0.4.6 — 2026-10-18

- **Fix** — the same track could play twice: the "stalled switch" nudge fired while a queue change was still in flight (index moved, nothing playing yet, position 0) and its extra `start` made Navidrome spawn a second mpv, while the action that caused the change spawned its own. The nudge is gone — the silence it patched came from the exclusive sound card, which `dmix` solved. Only one player on the box now after `set` → `skip` → `start`.
- **Fix** — a `start` is only sent after a skip when playback had actually stopped (repeat-one at the end, repeat-all wrap); skip resumes by itself.

## v0.4.5 — 2026-10-18

- **Fix** — two tracks could play at once. Navidrome switches tracks without a lock, so two overlapping jukebox actions (a skip from one device, a start from another) each spawned an mpv — and since the shared dmix device lets both open the card, both were audible. Jukebox writes are now serialized in juuku's server (one at a time), and the client no longer sends a redundant `start` right after a skip: `skip` already resumes playback itself.
- **Fix** — `package.json` and the changelog disagreed after 0.4.1–0.4.3 shipped with the old version string; a test now fails when the newest changelog heading and `package.json` differ.

## v0.4.4 — 2026-10-18

- **Fix** — the app version in Settings was stuck at 0.4.0: the last three releases bumped the changelog and the tag but not `package.json`, which is where `__APP_VERSION__` is baked from. A test now fails when the changelog's newest heading and `package.json` disagree, so the gate catches it instead of a person reading a stale number.

## v0.4.3 — 2026-10-18

- **Fix** — the Settings subtitle says where preferences actually live: on the juuku server, per account, shared by every device pointed at it. They are not stored inside Navidrome — the previous copy implied that.

## v0.4.2 — 2026-10-18

- **Fix** — the Settings page stopped claiming "Saved on this device only", left over from before preferences moved server-side.

## v0.4.1 — 2026-10-18

- **Docs** — the preferences directory has to be writable by the user inside the container (the image runs as `node`, uid 1000): either `chown 1000:1000 data` or run the service as the directory owner with `user: "<uid>:<gid>"`. Unwritable, the app still runs and preferences stay local to each browser.

## v0.4.0 — 2026-10-18

- **Feature** — Search is its own page: a field that focuses itself, the same three result groups (artists, albums, songs), and **Recent** — the ten things you actually opened, newest first, per device in `localStorage`. An entry is the entity itself (artwork, name, `Artist` or `Album · artist`) and tapping it goes straight there instead of re-running the query; `×` removes it, `Clear` empties the list. Typing never writes to it, so prefixes like "A, Ap, Aph" leave nothing behind.
- **Change** — the nav trades Favorites for Search: `Library / Playlists / Search / Queue` on the tab bar, same order in the sidebar's Yours group. The Favorites page still exists at `/favorites`, reachable from the sidebar's route list no longer — the household's **Favorites playlist** is pinned first on the Playlists page instead, marked with a heart.
- **Feature** — preferences live on the server, per Navidrome account, in one JSON file (`JUUKU_DATA_DIR/prefs.json`, mounted as `./data` in the shipped compose): lyrics settings, the recent search list, the library sort. They survive a redeploy and follow a person from phone to desktop; `localStorage` stays as the instant copy, so the first paint is already correct. `PUT /api/prefs` accepts only the keys the client owns and clamps their shapes (tested). The file is keyed by account, which is where per-user logins will hang.
- **Feature** — `Last played` works without scrobbling anything: Navidrome keeps no play history for jukebox playback, so juuku remembers the albums that played, newest first (40 of them, in memory — it resets with the container). The list is fed by the same poll, comparing against the last *observed* state so an action's cache invalidation cannot swallow a transition.
- **Fix** — the stalled-switch nudge only fires when playback *was* running: before, a deliberate pause from another device read as a stall and two clients fought each other with start/stop every few seconds (visible in Navidrome's log).
- **Feature** — the library sorts: `Alphabetical`, `Last added`, `Last played`, `Last released`, in a dropdown beside the Albums/Artists switch (choice kept per device). Last released maps to Navidrome's `byYear` with the range walked from this year down, because the API has no release order and returns the range in the direction it is given. Last played comes from juuku's own list of albums that played, since Navidrome's play history never sees jukebox playback.
- **Fix** — one spacing rhythm under every page title, measured on the rendered pages: 9px from the title to whatever follows it (subtitle, browse switch, search field, buttons), 22px from those controls to the content (album grid, rows, lists), and 14px from the search field to its results. Before, albums sat 11px, search 21px, the others 6px, covers touched the switch, and desktop stacked a 16px flex gap on top.
- **Fix** — one title size across the app: Albums and Artists were 30.4px against 33.6px everywhere else, and every page's first block now starts at 0px below the head (the search field carried 3.2px).
- **Fix** — the recent-search rows no longer wear a rounded hairline: the separator belonged to a `border-bottom` on a 10px-radius row, so it curved around the corners and read as a shadow. The line is on the row now, square from edge to edge.
- **Change** — the Albums/Artists switch sits on its own row under the title again, and the library head shares the standard spacing: title at the same offset and the same bottom padding as playlists, search and queue.
- **Fix** — the Search tab shows as active while you are on it.
- **Fix** — the search field is 16px on phones, the threshold below which iOS zooms the whole page on focus.

## v0.3.9 — 2026-10-18

- **Feature** — the queue counts down: the badge shows the tracks still ahead of the current one, and entries that already played stay in the list at 42% opacity (70% on hover, still removable) with the current row keeping its amber marker. Both come from `currentIndex`, so restarting the list through Repeat all or a fresh play restores the full count and full opacity by itself.
- **Change** — the queue header reads `track 25, 35 left` instead of `playing track 25`.

## v0.3.8 — 2026-10-18

- **Fix** — a search scrolls the page back to the top when its results land, instead of leaving you in the middle of the new list.
- **Change** — "Load more albums" carries a chevron, and that slot turns into a spinner while the next page is on its way.
- **Change** — the settings explanation sits on its own line full width (`353/353px` on a phone, `576/576px` on desktop) instead of wrapping at `46ch`.

## v0.3.7 — 2026-10-18

- **Feature** — library album cards carry the year beside the artist (`Ratatat · 2004`); the artist truncates and the year never does.
- **Change** — "Load more albums" carries a chevron, and the same slot turns into a spinner while the next page is on its way.
- **Fix** — a search scrolls the page back to the top when its results land, instead of showing the middle of the new list.
- **Change** — the online lyrics lookup is off by default and lives in Settings. It guesses: it gave Ratatat's *Wildcat* (instrumental) another recording's words and filed junk under near-matching titles. Off, the app shows only what the file carries — embedded tags and `.lrc` sidecars. The server hunts only when asked (`?lookup=1`), and version-marked titles are still never hunted.

## v0.3.6 — 2026-10-18

- **Fix** — lyrics are no longer borrowed across versions. A title carrying a version marker in brackets or after a dash (`remix`, `rmx`, `dub`, `edit`, `bootleg`, `rework`, `model`, `version`, `mix`, `live`, `acoustic`, `instrumental`, `karaoke`, `demo`, `reprise`) is not hunted on LRCLIB at all: remixes usually have no lyrics of their own, and LRCLIB keeps the original's words under the new title, so *Silent Alarm Remixed* was showing the words and timings of *Silent Alarm*. Embedded lyrics and `.lrc` sidecars still come through untouched — only the hunt is off. The plain fallback also got stricter: it now requires the same title (a remaster counts, a remix does not) and 3s of length instead of 5s.

## v0.3.5 — 2026-10-18

- **Fix** — a track switch that fails to start its player no longer leaves a silent queue: when the index advances but playback does not begin (position ≤2s, not playing), the client sends one `start` — at most every 15s. Measured cause: Navidrome kills the outgoing `mpv` and starts the next one immediately, and on a raw ALSA device the newcomer dies at audio init because the card is still held (`exit 4`, then `connection refused` on the socket).

## v0.3.4 — 2026-10-18

- **Change** — one upstream jukebox read at a time: `/api/state` shares a single `jukeboxControl get` for 900ms and single-flights concurrent polls, invalidated by any action. Three devices polling every second used to be three Navidrome calls a second, and a stuck player turned that into a wall of timeouts.
- **Fix** — a timeout no longer claims the server is unreachable: it reads "Navidrome did not answer within 10s — its jukebox player looks stuck". A wedged `mpv` is not a dead server (plain endpoints keep answering).
- **Fix** — `/api/health` probes the jukebox with a 3s budget, so a stuck player cannot hold the startup check for ten seconds while the UI says "connecting…".

## v0.3.3 — 2026-10-18

- **Fix** — library album titles are one line with an ellipsis (they were clamped to two, which made the grid rows uneven), and the title sits tight to the artist line: 9px under the cover, 2px between the two lines instead of the old `0.5rem` gap everywhere.

## v0.3.2 — 2026-10-18

- **Fix** — the last row of a long list sat under the docked player in the installed app: the page reserved the deck and tab bar but not the home-indicator inset, so the deck floated that much higher than the space kept for it. The padding now includes `env(safe-area-inset-bottom)` (measured 15px clear either way).

## v0.3.1 — 2026-10-18

- **Change** — README images retaken against a 274-album library on the released build: a new desktop shot plus a row of three phone shots (player, lyrics with the sung line lit, album page).


- **Fix** — the lyrics pane no longer shows a scrollbar: it auto-scrolls with the song, so the bar appearing and vanishing under the thumb was noise. Scrolling itself still works, and nothing moved (`clientWidth === offsetWidth`).

## v0.3.0 — 2026-10-17

- **Feature** — a Settings page: the lyric timing lead (slider, 0–2000ms, saved per device in `localStorage`, default 400ms) and the lyrics font (sans or serif, same size and leading, only the family changes). It also reports the Navidrome URL and version, the account, the jukebox state, the app version, the studio credit and the GitHub link. On phones the topbar cog opens it and turns into a close button; on wide screens it lives at the foot of the sidebar.
- **Feature** — the lyric highlight keeps its own clock: the position arrives on a 1s poll, so it extrapolates from the last sample and ticks 200ms, plus the configurable lead. Measured: 251ms from a seek to the correct line (was up to 1s).
- **Change** — bright sleeves no longer wash the page: the cover glow is drawn at `brightness(.72)` under a vertical veil, and `--dim` went from `#9a8870` to `#ab9a80`. On a white cover the title now measures 16:1 and the facts 7:1 (was 3.0:1).
- **Change** — secondary buttons are glass pills (translucent fill plus a visible outline) instead of bare outlines, so they hold up over artwork: cream on the composited fill lands around 5.5:1.
- **Change** — the album actions sit in the meta column on wide screens (cover left, title/meta/buttons beside it) and the close chevron in the player header ends the sheet without a drag; the deck's trailing button is the lyrics mic.
- **Fix** — the transport no longer shifts when a track change brings a longer or shorter title: the meta block reserves its tallest case (measured spread 0px across six tracks).

- **Fix** — the installed app washed out and blurred the top of the screen. iOS 27 standalone samples the viewport edge for a full-width fixed surface and blurs content when it finds none (WebKit's fixed-container sampling needs a background thicker than ~10px and not transparent). The app now ships `.status-bar-surface`: a fixed, full-width, 11px tall element that inherits the page colour but clips its background to empty text, so the sampler finds a surface while nothing is painted. It is inert, outside the app root, and only enabled in standalone WebKit (`@supports (-webkit-touch-callout: none) and (background-clip: text)` + `@media (display-mode: standalone)`). Mechanism and prior art: [nanobot#5942](https://github.com/HKUDS/nanobot/pull/5942), [MacRumors thread](https://forums.macrumors.com/threads/ios-27-pwa-blurred-across-top-of-screen.2489325/).

- **Fix** — the installed app hugged the home indicator while Safari looked fine: the player's height was `100dvh` inside a page that already pads for the status bar, so the player hung that many pixels below the screen and ate its own bottom padding. The height subtracts the top inset now, and the bottom spacing has a 48px floor instead of relying on an inset that Safari reports as 0.
- **Fix** — the SPA shell is served `no-cache` (hashed assets stay `immutable`): an installed app was launching a cached `index.html` and running an old build for hours.
- **Fix** — volume and seeking went through the same action wrapper as play/skip, and `button:disabled` dims the transport — so nudging the volume flashed every control. They no longer raise `busy`.
- **Fix** — the volume slider keeps its own draft state; dragging it re-rendered the whole player on every pointer move.
- **Feature** — "Play all" on an artist page, right-aligned with the title: the server fans out over the artist's albums (`GET /api/artists/:id/songs`) and returns one ordered list.
- **Feature** — covers fade in as they decode, and appear instantly when cached (`src/Cover.tsx`), so returning to the grid never re-fades them.
- **Feature** — the library stays mounted while you are in an album, so going back repaints decoded covers.
- **Change** — motion is slower and softer: `--dur-1/2/3` are 170/280/420ms on a gentler curve, and the view entry animation is gone (its transform was repainting the whole grid on iOS).
- **Change** — the player's lyrics mode is the player with the lyrics in the cover's box: same stage, same size, scrolling inside, and nothing else moves. The mic in the transport is the toggle (amber when on) and is disabled when a track has no lyrics.
- **Fix** — LRCLIB fallback: after the strict lookup misses, search by title with featured credits and parentheticals stripped, and pick the result whose length matches (within 5s). A hit outside that window is shown unsynced instead of scrolling its timestamps against a different edit.
- **Fix** — the hidden library slot no longer contributes its full height to the document (it made the app scroll by a whole library while the route was elsewhere).

## v0.2.0 — 2026-10-17

- **Feature** — the album page paints its cover behind the hero: blurred, radial-masked, fading out in every direction and bleeding up to the viewport top (the header needed `z-index: 1` to stay readable). The hero is one centred column on phones, with the cover at 62% and both actions sharing the row evenly.
- **Feature** — the same glow on the player, following the current track, and dimmer in lyrics mode where text sits on it.
- **Change** — the album year moved onto the facts line (`Various Artists · 2012 · 14 tracks · 24 min`); it used to drop to a line of its own as soon as the title wrapped.
- **Fix** — back navigation: the album, artist and playlist views hard-coded their parent, so Library → Artist → Album → back jumped to the library root. The router keeps its own stack now (it cannot read the browser's) and the link is labelled with where it goes, which also stays right after going back one step.
- **Feature** — edge-swipe back on phones: drag from the left edge, with a chevron cue. Vertical drags are ignored so the player's pull-to-dismiss still works, and it never fires over a sheet.
- **Feature** — multi-disc albums get a separator with the disc number (and Navidrome's `discTitles` name when the tags carry one) before each disc's first track. Verified on a 30-track two-disc album: separators land before track 1 and before track 16, single-disc albums stay untouched.
- **Fix** — lyrics mode had no `<h1>` and its scrollable pane was not focusable (both from axe): a visually hidden heading and `role="region"` + `tabIndex` now.

- **Change** — the album year moved onto the facts line (`Various Artists · 2012 · 14 tracks · 24 min`) instead of sitting under the title, where it landed on a line of its own whenever the title wrapped.
- **Fix** — long album titles broke the mobile hero: a 70-character title had ~215px next to a 122px cover and pushed the facts and the buttons around. On phones the hero is one column now (cover, then title, then facts, then actions), the cover is bigger, and the track count and duration are unbreakable units so "2 hr 29 min" never leaves "min" alone. Desktop keeps the cover beside the title at 200px. Verified with the longest titles in the library at 320px and 390px: no horizontal overflow, facts on one line.

- **Docs** — SETUP explains installing Juuku as a PWA on a phone: it works from a plain LAN address today, HTTPS is what unlocks secure-context features (service workers, push), and `tailscale serve` provides a certificate over MagicDNS without publishing anything — `funnel` is the one to avoid.

- **Feature** — a Buy Me a Coffee link in the README and `.github/FUNDING.yml`, so GitHub renders the Sponsor button.

- **Feature** — MIT licence, so the repo is actually open source rather than source-available.

- **Feature** — a `test` workflow runs on every push and pull request: `npm test`, `npm run build`, then builds the image and waits for `/api/live` to answer, so the Dockerfile cannot rot unnoticed between releases.
- **Feature** — `docs/social.png`, a 1280×640 card for the repository's social preview.

- **Change** — documentation neutralised for a public repo: no hostnames, LAN addresses, machine names, port-history anecdotes or descriptions of whose hardware this was built on. `sandbox-up.sh` also says plainly that `sandbox/music` starts empty instead of copying nothing and scanning.

- **Feature** — the app can be mounted under a path prefix: `tailscale serve --set-path /juuku` proxies to the container and strips the prefix. The build emits relative assets, the manifest uses `start_url`/`scope` `./`, and every API call is relative to the document. Verified end to end behind a prefix-stripping proxy.

- **Change** — README screenshot retaken against a 266-album library instead of the two-album sandbox, as a 1600px JPEG rather than a 2.9 MB PNG.

- **Change** — README hero: no tagline, smaller, and the lockup is now the app's own wordmark scaled with a transform instead of a generated SVG. The outline export could not reproduce the browser's kerning, so the kana sat a few percent off no matter how the anchors were measured; `public/logo.svg` and its build script are gone rather than left as a near-duplicate that drifts.
- **Fix** — `Jukebox is admin only (code 50)` was being reported as "jukebox mode off". The two cases are now separate messages.
- **Finding** — the admin requirement is not a bug: Navidrome checks `Jukebox.AdminOnly`, which defaults to **true** (`jukebox.adminonly` in `conf/configuration.go`, listed in the options reference, missing from the jukebox feature page). `ND_JUKEBOX_ADMINONLY=false` makes a plain account work, so SETUP/SECURITY now recommend that instead of promoting the user to admin.
- **Verified** — jukebox mode against a real server on a Raspberry Pi: `/api/play` queues and starts, position advances, the USB DAC sits in ALSA `state: RUNNING` under mpv, and skip, pause/resume and `setGain` all answer 200 through the deployed app.

- **Fix** — a Navidrome with jukebox mode off now answers 501 with what to do ("set ND_JUKEBOX_ENABLED=true … and make sure it has mpv and an audio output") instead of passing the upstream code on as a 502.
- **Fix** — the error strip no longer disappears before it can be read: the one-second poll used to clear it, so a failed action flashed a message and vanished. It stays until Dismiss (or until an action succeeds).

- **Fix** — the kana in the wordmark fell back to whatever Japanese face the device had (none of the self-hosted fonts carry kana), so the lockup looked different on every machine and could not be scaled faithfully. `ジューク` is now a 2.3 KB Noto Sans JP subset (OFL, self-hosted) used by the app and by the logo.
- **Feature** — `public/logo.svg`: the lockup as outlines, generated from those same fonts by `scripts/build-logo.py`, with the measured sizes and baselines at the top. The README hero is now that SVG scaled, instead of hand-set type that drifted from the app.

- **Change** — README hero: the app's own background gradient over a faded wall of covers from the library, with the lockup and its LED centred, rendered from real covers rather than a stock image (`docs/hero.jpg`, 63 KB).

- **Fix** — README: dropped the juicebox pun (nobody arriving fresh knows the old name) and added a settings table, because the two passwords are easy to confuse: `NAVIDROME_PASSWORD` is how the server signs in to Navidrome, `JUUKU_PASSWORD` is the optional lock on Juuku's own UI.

- **Change** — the app icon carries the amber LED dot from the wordmark, with a soft glow, in the square, maskable and favicon variants.
- **Fix** — the sign-in screen's lockup had the kana hanging off to the left of the name and the block pinned to the page margin: it now uses the same right-aligned stack as the rest of the app, with the glowing LED beside it (lit on purpose — there is no connection state to report before you are in).

- **Feature** — optional shared-password login (`JUUKU_PASSWORD`, off by default so LAN use stays frictionless). Sessions are a signed expiry stamp in an HttpOnly, SameSite=Lax cookie (no server-side store; changing the password ends every session), the compare is timing-safe, failures are throttled per address, and the shell does not mount — nor poll — until the session is known. `server/auth.mjs` carries three tests for the token, expiry, cookie parsing and the throttle.
- **Change** — the API answers `/api/session`, `/api/login` and `/api/logout`; everything else under `/api` requires the session when a password is configured.

- **Feature** — container deployment: multi-stage `Dockerfile` (build the SPA, then a runtime with `express` as the only dependency), running as uid 1000 with a read-only rootfs, `cap_drop: ALL` and `no-new-privileges`. `deploy/compose.yml` plus `deploy/.env.example` are the drop-in; configuration is environment only. Verified by running the image against the sandbox Navidrome: health, albums, covers, install assets and a jukebox write all work from inside a read-only container. Image is 246 MB.
- **Feature** — `/api/live`, a liveness route with no upstream call, used by the container healthcheck so a Navidrome outage does not mark the app unhealthy.
- **Change** — `react`, `react-dom` and `lucide-react` moved to `devDependencies`: vite bundles them at build time, so the runtime image needs `express` alone (runtime `node_modules` is 3.8 MB).
- **Feature** — `SECURITY.md`: what the app can do in the wrong hands, the LAN-only no-login trade, the reverse-proxy recipe, and the gaps stated plainly (no app login, no CSRF token beyond JSON-only writes, no rate limiting, password visible to `docker inspect`).
- **Feature** — `.github/workflows/image.yml` publishes a multi-arch image (amd64 + arm64) to GHCR on `v*` tags or manual dispatch.

- **Change** — navigation no longer blanks the view: the entry animation starts at 0.62 opacity over 160ms instead of from nothing, which on iOS read as a flash, and the album list now survives the unmount between tab switches (module cache, 40ms repaint instead of an empty grid while it refetches).
- **Feature** — a clear (×) button inside the search field, shown only when there is a query; it resets the field and returns focus.
- **Change** — search drops artist results with `albumCount` 0: they have nothing to open, so they were dead rows.

- **Change** — the title/tab row and the search field read as one unit now: the head's bottom padding dropped from 1.3rem to 0.35rem and the bar's top padding from 0.3rem to 0.2rem, so the gap is ~10px instead of ~30px.

- **Change** — on phones the Albums/Artists switch moved out of the flow and into the title row, right aligned above the search, so the grid starts one control higher. The switch is tighter there (smaller pills, 1.9rem title) and drops its count pills under 360px, where the two would not both fit; it still hides itself while search results are showing.

- **Feature** — installable home-screen app: `manifest.webmanifest` (standalone, warm `#14100b` theme, 192/512/maskable-512/SVG icons), `apple-touch-icon.png` at 180, `apple-mobile-web-app-*` meta with `black-translucent` so the app draws under the status bar (the page carries `env(safe-area-inset-top)` for it), and a new record-and-amber-label icon derived from the wordmark's LED. Rendered from `public/icon.svg` at exact sizes, no transparency.

- **Fix** — the search glyph flashed once and then vanished: it was an overlaid element sitting inside the field's own `backdrop-filter` layer, so the compositor dropped it after the first frame. It is the field's `background-image` now (a data-URI lucide magnifier), which no layer can paint over, and the native `search` decorations are suppressed so no second glyph appears on Safari/iOS.

- **Change** — the pinned shade is a softer fade: 0.9 at the viewport edge tapering over 2.7rem (phone) / 2rem (desktop) instead of running almost solid, so the artwork stays visible underneath and the band reads as a gradient rather than a blackout. Cream on the darkened backdrop still measures 10.6:1 against the busiest cover behind it.

- **Feature** — count pills everywhere the browse switch appears: the phone tabs and the desktop rail both show albums/artists totals, from one cached fetch (a module-level hook shared by the rail and the view).
- **Feature** — a search glyph inside the field.
- **Change** — on desktop the title and the search share one sticky row, and the row shrinks when pinned (title 2.5rem → 1.5rem, field padding and font down too), taking 53px instead of 72px. The phone keeps its behaviour: title scrolls away, only the field pins.
- **Fix** — the *first* attempt at that row left the title grey and washed out: the phone bar's gradient is absolutely positioned, and with the bar made static on desktop it escaped to the sticky head and painted over the title. It is now disabled at that breakpoint, with the row carrying its own fade.

- **Feature** — the library's Albums/Artists switch carries count pills. The album number comes from `GET /api/counts`, which reads Navidrome's own `X-Total-Count` (Subsonic never reports totals) and is cached for five minutes; it returns `null` on a non-Navidrome server, and the pill simply does not render. The artist number is the length of the list the tab actually shows — Navidrome's native artist total counts every credit row (one library reported 827 of them against 73 browsable artists), so it would have been a lie next to a list of 73.

- **Change** — the pinned search is a floating glass pill now: the band behind it is gone, so covers scroll past and only the field frosts them (no cut edge), and it floats 0.55rem from the top instead of hugging the viewport. Its own tint went to 0.8 alpha because at 0.52 the placeholder over a bright cover measured ~2.5:1; the placeholder uses `--glass-text` for the same reason.
- **Change** — the pinned search sits on a gradient again, but a fade rather than a band: opaque at the viewport edge, gone 2.2rem below the field, and with no `backdrop-filter` on it — the blur on that box was what produced the visible cut line the first time round.
- **Note** — the tab bar was tried as a floating rounded container matching the deck, then reverted to the full-width bar on request; only the deck floats. Page padding still follows the deck's presence through a `has-deck` class instead of one blanket value.

- **Feature** — ice glass: the search field, the now-playing deck and the tab bar are translucent surfaces with a blurred, slightly saturated backdrop and a hairline top sheen instead of flat panels. Text that sits on glass moved to its own tone (`--glass-text`), because over a bright cover the regular `--dim` and `--muted` measured 3.6–3.8:1 — the deck's sub line and the tab labels now measure 4.98–5.18:1 against a pure white backdrop, cream 8.1–8.4:1. A `@supports` fallback keeps the surfaces opaque where `backdrop-filter` is missing.
- **Change** — the pinned library search drops its filled band for a gradient that fades the covers out under it, so nothing reads as a hard-edged toolbar.

- **Feature** — the library search pins to the top once the page title scrolls away, so a long library can be searched from anywhere in the list. It fades in a near-opaque blurred band only while stuck, driven by an `IntersectionObserver` on a one-pixel sentinel, so at rest it still reads as part of the header. The search covers songs, albums and artists, so the Albums/Artists switch stays in the flow and scrolls away. On desktop the field is capped at 34rem instead of spanning 1000px.

- **Fix** — readability pass, measured rather than guessed: root type 15px → 16px, `--dim` was `#6f5f4c` at **3.08:1** (below AA) and is now `#9a8870` (5.5 / 5.2 / 4.8 over bg, panel, raised), `--muted` lifted to `#b6a68c` (7.0–8.0:1). Every informational label under 12px was raised (now-playing sub and time 11.3 → 12, tab labels 10.8 → 12, badge 10.2 → 11.5). The wordmark went 21.6 → 25.6px on phones (24 → 28px in the rail) and its kana 7.8 → 10.4px at weight 600.
- **Fix** — accessibility: axe now reports **no violations** across library, album, artists, queue, playlists, favorites, player and the open sheet. The one remaining hit was the now-playing bar sitting outside any landmark (`region`), so it is a labelled region now. The sheet and the delete confirmation take focus on open and close on Escape, with `role="dialog"`, `aria-modal` and `aria-labelledby`.
- **Note** — axe reports 8–34 `color-contrast` nodes per view as *incomplete*, because the app paints gradients behind text and axe cannot resolve the effective background. Those pairs were checked by hand against the three surface tokens instead; anything on a gradient edge is a judgement call, not a measurement.

- **Change** — the project is **Juuku** (`ジューク`): package name, README, docs, script and container names, and the wordmark now sets the latin name over the kana in small letterspaced type. Chosen after checking the old name was a live registered trademark (Juicebox App, Inc.), taken on npm, on all three domains, and used by five other music projects; `juuku` is free on npm with no projects using it. The sandbox was rebuilt under the new compose project, so its volumes and admin password (`juuku`) are fresh.

- **Fix** — the artist initial sat low in its circle: a lone cap never centres by line box in Instrument Serif (its ascent/descent dominate), so the fallback now uses the UI face, flex-centred with `line-height: 1`.

- **Feature** — browse-only mode: a Navidrome without jukebox mode answers **501** ("This endpoint is not implemented") for `jukeboxControl`, not just "Jukebox is disabled". `/api/state` now returns an empty queue in that case, so the library, playlists and search work against any Navidrome without an error strip; `/api/health` reports `jukebox.enabled: false`.
- **Feature** — `scripts/remote-instance.sh`: serves the built app against another Navidrome on a second port, credentials from the environment, so the local sandbox stays untouched.
- **Fix** — artist rows without any art showed a blank circle: the initial fallback lost its size when the avatar rule was narrowed to `img`. It is 44 px with the first letter again.
- **Verified** — pointed at a 266-album library (73 artists): first grid 112 ms, album detail 17 ms, cover 137 ms, search 28 ms, paging to offset 240 works, no console errors.

- **Change** — the `Favorites` playlist can’t be deleted: `/api/playlists/:id` answers 409 for it and the detail page hides the Delete action, with a one-liner explaining that the heart owns it. Other playlists delete as before.

- **Feature** — deleting a playlist, with a real confirmation dialog ("the playlist goes, the tracks stay"), Cancel first, then a solid Delete. `DELETE /api/playlists/:id` calls Navidrome's `deletePlaylist` and returns the name for the toast.
- **Fix** — that dialog first rendered mid-screen instead of anchored to the bottom: it lived inside `.view`, whose entry animation leaves a transform that hijacks `position: fixed` for descendants. Overlays are portalled to `document.body` now.

- **Change** — repeat lives on the queue page only; the player header's repeat button is gone and in its place is "add this track to a playlist", which opens the playlist picker directly (no intermediate menu). The desktop deck gained the same action next to the favourite, so it is reachable while a track plays on big screens too.

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
- **Feature** — jukebox audio actually plays on the host's speakers: `scripts/audio-dev.sh` exposes PulseAudio on the docker bridge (`172.17.0.1:4713`) and recreates the container with `PULSE_SERVER` + `mpv --ao=pulse`. Verified: mpv streams at 44.1 kHz into the default sink and `position` advances in real time.

- **Feature** — project skeleton: Vite + React UI, Express API, `.mjs` Subsonic client (no build step). Config via `.env`.
- **Feature** — full jukebox control surface: `state` (queue + status in one call), `control` (`set`, `start`, `stop`, `skip` with offset, `add`, `clear`, `remove`, `shuffle`, `setGain`), library search, album browsing and a cover-art proxy.
- **Feature** — POC UI: now playing with live position, transport, volume, queue with per-row skip/remove, search-to-add and add-album. Polls once a second, pauses while the tab is hidden.
- **Feature** — throwaway Navidrome sandbox (`docker-compose.yml` + `scripts/sandbox-up.sh`): jukebox enabled, `mpv --ao=null`, 15 tracks seeded from two albums, admin bootstrapped, scan forced.
- **Feature** — docs set: INDEX, API, ARCHITECTURE, SETUP, CHANGELOG.

### Notes

- Behaviour verified against Navidrome 0.64.2: pause/play, skip with offset, gain, add, remove, shuffle all round-trip, and `position` advances in real time under `--ao=null`.
- The dev server sits on 3100 and the API on 3101 (`PORT` and `server.port` move them).
- Music and data live in docker named volumes because container bind mounts from the workspace are unreadable here.
