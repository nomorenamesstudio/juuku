# Changelog

Newest first. Tags: **Feature**, **Fix**, **Break**.

## How versions are cut

`package.json` and the `v*` tag move together: a fix bumps the patch, a feature the
minor, and the tag is what CI builds the published image from.

## v0.8.4 — 2026-10-21

- **Fix** — no root anywhere, for real. The mpv sockets `Restart playback` uses are created `0600` under mpv's uid, so the docs asked for `user: "0:0"` — a root container that can overwrite anything inside the directories it mounts. Matching the uids removes the need: Navidrome and juuku both run as uid 1000, mpv's socket comes out owned by 1000, and juuku opens it as a normal user. `deploy/compose.yml` now ships that (`user: "1000:1000"`, the socket mount back on) and the two directories are owned by the same uid.
- **Proven without privileges** on the sandbox, both as the host app and as the built image with `--read-only --cap-drop ALL --no-new-privileges`: uid 1000 processes, sockets `srw------- 1000 1000`, `players: 1, blocked: 0`, and a leaked idle mpv beside Navidrome's own → `Restart playback` reported `quit: 1`, restored the queue at the same index and left one player and one socket.
- **Docs** — SETUP.md's kill-switch section gives the uid-matched recipe (and why not root), including the audio group a non-root Navidrome needs for `/dev/snd`; SECURITY.md states the same in its hardening list.

## v0.8.3 — 2026-10-21

Full code review, own pass plus an independent one from GLM through OpenRouter. Every item below was verified while fixing it.

- **Fix** — the login throttle could be dodged. `trust proxy` was pinned to `1`, so with no proxy in front `req.ip` was whatever the client put in `X-Forwarded-For`: a fresh address per attempt meant the 8-failures-per-address rule never fired (measured: nine wrong passwords with rotating headers all got a fresh window before the fix). Trust is now opt-in through `JUUKU_TRUST_PROXY` (a hop count or `loopback`), and the failure map has a ceiling.
- **Fix** — a mangled session cookie answered 500 everywhere. `decodeURIComponent` threw a `URIError` out of a synchronous route, so `Cookie: juuku_session=%` broke the session check the app boots on, and the client reported "expected JSON". A cookie that does not decode is simply not a session now.
- **Fix** — the preferences file lost data when two requests arrived together. The "already loaded?" check sat before the `await`, so each caller built its own store and every patch but the last one was written into an object nothing read again; they also shared a single `.tmp` path, so the loser's rename failed with ENOENT. On a deliberately slowed filesystem, 20 concurrent saves lost 19 updates and 16 of them failed outright. One load and one write at a time now: 20 of 20 land, no failures.
- **Fix** — "Last played" never filled on a fresh install. `recent.json` was written without creating its data directory and with an empty error callback, so on a checkout where nothing had written a preference yet every save failed with ENOENT, silently, for good.
- **Fix** — removing a favorite (or a playlist track) resolved an index and then wrote it back unsynchronized, so two devices removing at the same time could delete the same slot twice and drop a different track. Both deletes run through the same one-write-at-a-time chain the jukebox uses.
- **Fix** — `/api/player/restart` was reachable by a cross-site form POST: it never read a body, so the "a form cannot send `application/json`" answer to CSRF did not cover it. Every write now has to carry that content type (415 otherwise).
- **Fix** — `?day=` was an unvalidated cache key. Any string left a whole shuffled library behind in the daily-picks cache and re-ran the album pagination; `day` is validated as a date and the cache keeps four entries.
- **Fix** — a state read that overlapped a write cached the queue from *before* it, so the UI could show the old order for a moment after a skip. Reads are numbered now and an older one cannot land.
- **Fix** — the client poll could stack up behind a stuck player. One tick per second with no in-flight guard meant ten requests behind one ten-second timeout, answering out of order and walking the playback position backwards.
- **Fix** — a failed fetch left views lying. The album grid said "No albums here yet", the artist page sat on "…", and the playlist sheet's unhandled rejections never surfaced; the rail and Artists tab also stayed empty for the whole session after one transient failure. They retry and say so now.
- **Fix** — a track removed from a playlist through its action sheet stayed on the playlist page until a reload.
- **Fix** — smaller ones: `?size=abc` and negative offsets reached Navidrome as `NaN` and came back as 502 instead of a default page; an unknown `/api` path answered with `index.html` and a 200; `formatTotal(7199)` said "1 hr 60 min"; a preference write that failed while offline was dropped instead of retried; on a phone the pull-to-refresh gesture was thrown away every second.
- **Fix** — the watchdog could cut a live player loose. mpv creates its socket `0600` under its own uid, so a juuku container running as another user cannot open it; that was counted as a dead player and the socket file was deleted, which took away Navidrome's only handle on the process. It kept playing, and the next play started a second mpv beside it — the double playback this feature exists to prevent. A socket is now alive, dead or unreachable, only a dead one is removed, unreachable ones show in Settings as "N not reachable" with the reason, and **Restart playback** says how many it could not open. Measured on the sandbox: Navidrome's own player beside a leaked idle mpv, sockets given the app's uid → restart quit the orphan, queue back at the same index, one player left.
- **Fix** — Play album and Play next left the poll serving the queue from before them for up to a second; both invalidate the state cache now, like every other write.
- **Fix** — the lyrics button in the wide transport bar stayed active on a track with no lyrics, and pressing it opened a player whose lyrics column had nothing to say. It dims now, with a "No lyrics for this track" tooltip; inside the player it still closes the view, and the phone's in-player toggle keeps its own rule. The bar and the player share one lyrics lookup instead of asking twice, and a miss is remembered for the session the way the server remembers it for a day.
- **Deploy** — `deploy/compose.yml` no longer mounts Navidrome's mpv sockets by default. Half-configured (visible but not openable) it cannot heal anything, so the two lines are commented out with the `user: "0:0"` requirement stated.
- **Sandbox** — the dev compose gives mpv `--ao=pulse,null`, a priority list: sound when the host bridge from `scripts/audio-dev.sh` is up, a silent player when it is not. With only `--ao=pulse`, a host whose audio daemon is down answers every play with `can't connect to mpv's socket: connection refused`, because mpv exits the moment it cannot open an output.
- **Docs** — SECURITY.md no longer claims "on-disk state: none" while `./data` holds two files, and `deploy/.env.example` no longer suggests a non-admin Navidrome account without saying that jukebox mode needs `ND_JUKEBOX_ADMINONLY=false`. API.md lists the seven endpoints it was missing, SETUP.md documents `JUUKU_TRUST_PROXY` and what an unreachable player socket means.

## v0.8.2 — 2026-10-20

- **Fix** — repeat and the end of the queue. Navidrome's end state is stable (`playing=false`, index at the last track, position 0) but it was detected as an *event* (`previous.playing && !playing`), so it only fired when a poll happened to straddle the end: any gap in polling — a hidden tab, a sleeping phone, a slow poll — set the snapshot to stopped first and the transition was gone. The end is read as a state now, armed once playback has been seen in the session and handled once per episode. Repeat off closes the player bar and gives its space back, repeat all starts the queue again from the first track, repeat one replays the last one.
- **Album view** — the heart column is gone: "Add to favorites" / "Remove from favorites" sits in the track's action menu with the rest, in the row menu the album previously only had for queue and playlist actions. Views that keep a heart column (Favorites, playlists, search) are unchanged, and the album's table header dropped to four columns to match.

## v0.8.1 — 2026-10-20

- **Queue** — each row shows the album beside the artist (`Depeche Mode · Ultra (Deluxe)`), so a queued artist portfolio no longer leaves you guessing which record is playing. The artist stays the brighter of the two, the album one step back, and long names ellipsize on a phone.

## v0.8.0 — 2026-10-19

- **Queue** — it keeps the playing track on screen instead of making you scroll to it: the already-played history folds away, three tracks stay above the current one, and a muted "65 earlier tracks" row unfolds the rest. The window slides forward as the queue advances, so nothing has to chase it. The queue is treated as transient — it folds again on every visit and the router keeps no offset for it, so coming back starts at the top rather than dropping a remembered offset onto a much shorter list.
- **Mini player and footer** — the time now reads played over length (`3:06 / 4:16`) instead of the elapsed time alone.
- **Docs** — the theme strip shows the same screen in Mocha, Modern and Geek.

## v0.7.7 — 2026-10-19

- **Themes** — the Classic theme is now **Mocha**: same amber serif look, a better name. The id moved with it (`data-theme="mocha"`, `localStorage['juuku.theme']`), so a browser that had `classic` stored lands on Mocha, which is the default anyway.

- **Landing page** — `site/` is a static page for GitHub Pages: what Juuku is, what it does, the three themes and the real screenshots of each per theme. Mocha is the default; the dropdown in the header and the cards in the themes section restyle the page *and* swap every screenshot, and the choice persists across visits (and matches the app's own `juuku.theme`). The feature list draws each glyph from the theme's own icon set, and the page makes no third-party requests: fonts are the app's own, self-hosted.
- **Landing page, screenshots** — the gallery is a timed carousel: one slide per screen with desktop and phone side by side, phone only on a phone, and a progress bar per slide underneath (pauses on hover, focus or off screen, and stays put under `prefers-reduced-motion`). The phone sits on top of the desktop shot at 90% of its height, overlapping its edge by 15% of its own width, and casts a shadow on it.
- **Landing page, hero** — the copy sits beside three phone screens: the album page in front, the library and the lyrics tucked behind it at 90% height, peeking left and right. Behind all of it, a faded wall of album covers (`images/covers.jpg`, 64 covers) that the name block reuses as a band.
- **Landing page, copy** — the hero leads with the need (jukebox mode needs a remote) instead of an accusation, "Learn more" scrolls to *What it does*, the FAQ gained *Why not a native app?* with an honest answer and a link to the dev-fee donation, and the email address copies to the clipboard with a one-line toast instead of opening a mail client.
- **Landing page, icons** — every glyph comes from the theme's own set, now including the footer links (GitHub, docs, security, coffee) and the shell / AI agents tabs.
- **Landing page, accessibility** — every touch target is at least 24×24 (the carousel bars keep their 4px look with a 24px hit area), and a measured pass checks the contrast of all 77 text runs per theme against the pixels actually painted behind them, cloud included.
- **Landing page, analytics** — a self-hosted Umami beacon counts visits to the landing page (cookieless, honours `data-do-not-track`, locked to the production domain). The website id is a repository secret injected at deploy time, so the public repo carries no tag; GitHub Pages site `juuku` = `9b5888ec-82f9-4acf-92f4-dc15ce3aab09` in Umami.
- **README images** — the hero and the screenshot block are baked from the landing page instead of the app: the hero is its wordmark, line and phone stack over the cover wall, and the screenshots became one mock of the album page on a wide screen with the same screen on a phone. The three separate phone shots are gone.
- **Social cards** — `docs/social/` renders three banners from the page's own pieces (logo lockup, Instrument Serif headline, the faded cover wall and the phone stack): the 1200×630 link preview, a 1280×640 GitHub preview and a 1080 square. The link preview ships as `site/social-og.jpg` and is the page's `og:image`.
- **CI** — `.github/workflows/pages.yml` publishes `site/` to Pages on any push that touches it.

## v0.7.6 — 2026-10-19

Wide screens got the pass they needed; the phone layout is unchanged.

- **Desktop shell** — one flat rail (Home, Search, Albums, Artists, Playlists, Queue, Settings at the foot) instead of the Browse/Yours groups; the search field fills the content column; page titles no longer stick to the top; the library sort sits on the title row, right-aligned.
- **Desktop library** — artists render as a wall of round faces with album counts, matching the daily shelf, instead of the thin list.
- **Shelves** — back/forward buttons step a shelf by 40% and disable at the ends (tracked with a scroll listener plus a `ResizeObserver`); the *See all* action wears the same button shape while the arrows are visible. Hidden on touch, where the shelf is swiped.
- **Player on a wide screen** — the artwork stays on the stage and the lyrics live in the aside. Before, toggling lyrics swapped the cover out *and* rendered the panel, so the words appeared twice and the cover vanished. The mic toggle is hidden there, because the panel is always present.
- **Footer player** — the title takes the width it has (the 340px cap clipped it), and the queue button is gone: the rail already has Queue.
- **Tooltips** — rail entries, shelf arrows, transport, play/pause, lyrics, favorites, add-to-playlist, volume and the row icons all title themselves.
- **Docs** — README screenshots refreshed from one session (hero kept as is), plus a Classic/Modern/Geek strip.

## v0.7.5 — 2026-10-19

- **Fix** — the double playback, at its source. Navidrome's debug log shows the same pattern every time: `Track switching detected` → `Executing mpv command`, and in the same second `action=start` with `Loaded track: %!s(<nil>)` → a second `Executing mpv command`. Between closing the finished track and loading the next one Navidrome's `ActiveTrack` is nil, and `Start` in that window spawns another mpv beside the one the switcher just started — then the watchdog cleans up. `/api/control` no longer takes a `start` at face value: it reads the queue, waits 350ms for a switch to land, reads again, and drops the write when the queue is already playing (a genuine start on a stopped queue still goes through, ~380ms). The same guard drops a `stop` on an already stopped queue. Writes are logged as `[control] …` so the next occurrence is attributable.

## v0.7.5 — 2026-10-19

- **Fix** — the double playback, at its source. Navidrome's debug log shows the same pattern every time: `Track switching detected` → `Executing mpv command`, and in the same second `action=start` with `Loaded track: %!s(<nil>)` → a second `Executing mpv command`; the watchdog then cleans up. Between closing the finished track and loading the next one Navidrome's `ActiveTrack` is nil, and `Start` in that window spawns another mpv beside the one the switcher just started. `/api/control` no longer takes a `start` at face value: it reads the queue, waits 350ms for a switch to land, reads again, and drops the write when the queue is already playing (a real start on a stopped queue still goes through, ~380ms). The same guard drops a `stop` on a stopped queue, and writes log as `[control] …` so the next occurrence is attributable.
- **Fix** — the player byline: the year sits with the album (`The Inevitable End (2014)`) instead of after the artist, and the artist is set in the foreground colour with the album one step back, so the two are easy to tell apart.
- **Fix** — the home screen cached its first load for the whole session, so a shelf that filled later (Last played) never appeared until a reload; it re-reads on revisit with a 30 second cache.
- **Fix** — `/data` is a named volume in the shipped stack. A rootless Docker cannot write an owner-owned bind mount from the container's root, which is why `prefs.json` and `recent.json` were silently failing with `EACCES`.

## v0.7.4 — 2026-10-19

- **Fix** — coming back from an album kept only the first page of the library: the shell remounts the content element per route, and the remount refetched page one, dropping whatever you had loaded — which is also why the restored scroll landed inside the first thirty. The cached list is reused when the sort has not changed, re-picking the current order no longer empties the grid, and changing the sort starts at the top.

## v0.7.3 — 2026-10-19

- **Fix** — a long album title wrapped as one centred box in the player byline, leaving the artist alone on the first line and `· 2024` on a third. The byline is two lines now: the artist with the year, then the album wrapping inside its own line.
- **Fix** — views came back at the top after a detour: opening an album from the library and stepping back lost your place. Every non-player view remembers its offset (`history.scrollRestoration` is handed to the app, and the offset is sampled on scroll while the view is still on screen — sampling it on `hashchange` read the clamped value, 1400 became 377).

## v0.7.2 — 2026-10-19

- **Feature** — a **home screen** at `/`: horizontally scrolling shelves of ten — *Last played*, *Last added*, *Newest release*, *Daily picks*, *Daily artists*. Each title carries a **See all** that sets the matching library sort and opens the library; the artist shelf goes to the Artists tab. The two daily rows are the whole library shuffled with a seed from the local date, so they hold still all day and turn over at midnight, and `Various Artists` is left out of the artist row (the Artists tab keeps it).
- **Feature** — **playlists moved under the library** as the third tab, with its own counter in the switch (`Albums 310 · Artists 80 · Playlists 1`); `/playlists` still lands there. The tab bar is now *Home · Library · Search · Queue*, and the rail lists Home, Albums, Artists, Playlists.
- **Feature** — `Daily picks` joined the album sort dropdown, so the home row's "See all" has a full-page view of the same shuffled order.
- **Feature** — the **played-albums log is persisted** (`recent.json` in the data dir). It is the only record of jukebox playback, and every restart used to wipe the "Last played" row and sort.
- **Change** — the home shelves' "See all" wears the back-link style with a trailing chevron, and section headers now outrank their actions: labels are `13.4px/600`, actions `11.5px/500` (they were the other way round — the action was larger than the header).
- **Fix** — modern's chevrons were Phosphor's filled triangles (its fill weight has no chevron at all); the chevron icons now fall back to the stroke glyph in every theme but geek.
- **Fix** — `request()` no longer swallows a non-JSON body as `{}`: a path the server does not know answers with `index.html`, which used to turn into an empty object and a crash far from the cause. `getHome()` also validates its payload.
- **Docs** — `/api/home`, the `daily` sort type and the home-row reasoning are documented.

## v0.7.1 — 2026-10-19

- **Change** — the modern theme's accent is **Glacier turquoise** (`#3adbc9`) on a cooled grey canvas, instead of a green that looks like every streaming service. Contrast against the theme's own surfaces: 10.9 on the page, 10.1 on panels, 9.6 for ink on the accent.
- **Fix** — the last warm colors were hardcoded rather than themed: the **glass** behind the mini player and the tab bar (`rgba(22,18,14,.82)`, `#c8b8a0`), the un-sung lyric line (`#59493a`), the ink on accent-filled buttons (`#201505`, `#1a0f0a`) and the danger toast's brick red. All of them are tokens now — `--glass-strong`, `--glass-text`, `--lyric-dim`, `--accent-ink` and a mix of `--danger` — with Classic's exact values kept in `:root`, so the cool themes carry no brown.

## v0.7.0 — 2026-10-19

- **Feature** — the Albums/Artists switch is icons now: a record for albums, a person for artists, each with its album count. The words stay in `aria-label`/`title`. Freeing that width put the full sort labels back — *Alphabetical, By artist, Last added, Last played, Last released*. The record is lucide `Disc3` in classic, Phosphor `vinyl-record` in modern, and a hand-drawn 24px pixel disc in geek (Pixelarticons has no vinyl).
- **Feature** — **By artist** sorts albums by artist name, grouped together, then by album.
- **Feature** — alphabetical order ignores decoration: `sortKey()` starts at the first letter or digit and folds accents, so `“Heroes”` sorts under H and `...I Care Because You Do` under I, while a name with nothing but symbols (`★`, `✝`) stays in front. Navidrome collates the literal title, so juuku fetches the two alphabetical album orders itself (pages of 500, cached five minutes) and slices them; the Artists list sorts the same way. Tested.
- **Change** — one control recipe: the search field, the create-playlist capsule, the browse switch and the sort dropdown are all 48px tall, `--panel` on a 1px `--line` border, `--field-radius` (12px, 1px in geek) and 16px type. Every control, label, row and title now starts on the same 18px left edge.
- **Change** — the create row is one capsule: input and **Create** share a border, the button stretches to the field height and the border warms to the accent on focus.
- **Fix** — the mini player and the deck's bottom clearance were gated on "tracks ahead", so both vanished on the last track of a queue while the music played.
- **Fix** — the lyrics pane was a square (sized like the cover), which left the words in a narrow centred strip whenever the stage was shorter than the column; in lyrics mode it fills the stage instead.
- **Fix** — the search page's field, labels and rows had three different edges, and "Recent" sat twice as far below the field as "Artists" (a flex container does not collapse its children's margins, and baseline alignment against a larger Clear link pushed it down another 4px).
- **Fix** — the search field keeps the keyboard up while the page scrolls under the fixed deck and tab bar; scrolling or tapping outside the field now dismisses it.
- **Docs** — the alphabetical rule and the control recipe are in ARCHITECTURE.

## v0.6.0 — 2026-10-19

One release for the theme work: three themes, three icon sets, and the small UI
fixes that came out of looking at them.

- **Feature** — **three themes**, picked in Settings and kept per device (a theme is about the screen you are holding, not the account). **Classic**: the look from before — serif titles and lyrics, amber, cover glow; library album titles in the serif at 1.18rem, because Instrument Serif reads smaller than the sans at equal pixels. **Modern**: bold sans titles, green accent, neutral dark grey canvas with no accent wash, sans lyrics, corners at 12px. **Geek**: **Geist Mono** everywhere, terminal green, 1px corners, no glow, no wash.
- **Feature** — **three icon sets**, one per theme: lucide strokes (classic), **Phosphor** fill/bold (modern, MIT) and **Pixelarticons** (geek, MIT, `crispEdges`). Each wrapper subscribes to the theme, so the swap rides the repaint and no call site knows. The lyrics button is a vocal mic in classic and modern, a page of lines in geek; the ✕, plus, dots, queue and playlist glyphs come from Phosphor's bold weight because the fill versions paint a rounded square around the mark.
- **Feature** — the stylesheet reads from tokens (`--bg`, `--panel`, `--line`, `--text`, `--accent`, `--radius`, `--font-display`, `--lyric-face`, `--glow`, `--wash`), and the 43 hardcoded brand tints became `color-mix()` of them, so a theme repaints accent chips, row highlights, glass and the glow. Applied before first paint.
- **Feature** — the geek theme's corners are 1px everywhere, cover images included, and the now-playing bars are square.
- **Change** — the create-playlist row is one capsule: input and **Create** share a single border, the button stretches to the field height and the border warms to the accent on focus.
- **Change** — the Playlists page drops its "Built here or in any Subsonic client" line.
- **Change** — the separate lyric-font setting is gone: the theme owns the typeface.
- **Fix** — the queue's remove button was a plus rotated 45°, which geek drew as a rotated pixel plus; it is a real ✕ now.
- **Docs** — asset credits: fonts under SIL OFL, Pixelarticons and Phosphor under MIT.

## v0.5.3 — 2026-10-19

- **Fix** — the watchdog threw `listSockets is not defined` instead of cleaning up, because the restart routine still asked for a helper the status endpoint had stopped importing. The restart response reports the live player count again.

## v0.5.2 — 2026-10-19

- **Fix** — the player count only counts sockets that actually answer: a dead player leaves its socket file behind, so the watchdog still reported "2 running" after cleaning up. Dead files are swept; a live player is never touched by the housekeeping path.

## v0.5.1 — 2026-10-19

- **Feature** — a watchdog for the duplicate player: every five seconds juuku counts the mpv sockets and, if more than one is alive, runs the restart routine itself (clear, quit the leftovers, restore the queue and index), at most once a minute. `JUUKU_MPV_WATCHDOG=0` turns it off.
- **Change** — Navidrome runs with `TMPDIR=/mpv-sockets` shared into this container so its players are visible, and the debugging log level is on for a day to catch the double spawn at its source.

## v0.5.0 — 2026-10-18

- **Feature** — a kill switch for a lost player: Settings gains a **Players** line (`2 running`) and a **Restart playback** button. It clears the queue so Navidrome quits the player it knows about, sends `quit` to every mpv socket still alive, then restores the queue and the index. No ssh. It only appears when Navidrome's socket directory is shared with this container (`JUUKU_MPV_SOCKETS`, see SETUP) — without that the page says `not shared`.
- **Fix** — a `start` after a skip is sent only when playback had stopped; the stalled-switch nudge is gone (it was spawning a second mpv).

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
