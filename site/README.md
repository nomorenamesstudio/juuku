# Landing page

The static page behind <https://juuku.nomorenames.studio>, also served at
<https://nomorenamesstudio.github.io/juuku/> when no custom domain is set. No build
step: `index.html`, `style.css`, `script.js`, fonts and `images/`. GitHub Pages
publishes this directory through `.github/workflows/pages.yml`.

## Preview locally

```sh
cd site && python3 -m http.server 4310
```

## How it is put together

- **Themes** — `html[data-theme]` is `mocha` (default), `modern` or `geek`, and the
  CSS tokens are the app's own, copied from `src/styles.css`. The dropdown in the
  header and the three cards in *Three themes, one layout* are one state; the choice
  persists in `localStorage['juuku.theme']`, so a visitor who has used the app in a
  theme sees the same one here.
- **Logo** — an outline SVG at `logo.svg`, inlined once as a `<symbol>` and `<use>`d
  in the header and the footer. Both lines are placed from the app's own layout:
  per-character positions measured in the browser for the app's lockup CSS (latin
  1.75rem Instrument Serif, kana .72rem Noto Sans JP at .16em, right-aligned with the
  trailing letter-space cancelled), outlines from the self-hosted fonts through
  `fontTools`, LED at the app's `gap`/`--accent`. Rebuild it that way if the app's
  lockup CSS ever changes — the numbers live in the file, not in a script. Only the
  colours come from the theme; the type never does.
- **Icons** — the feature list carries three glyphs per entry, one drawn by each
  theme's own set (Lucide, Phosphor, pixelarticons — lifted from `src/icons.tsx`,
  `src/solid-icons.tsx` and `src/pixel-icons.tsx`); CSS shows the set that belongs to
  the current theme.
- **Hero** — the copy sits beside three phone screens (`.hero-shot`): the album page in
  front, the library and the lyrics behind it at 90% of the front's height, both
  peeking out sideways, no rotation, the front casting the shadow. Under 60rem it
  stacks under the copy, one screen.
- **Screenshots** — every `<img data-shot="…">` points at `images/<theme>/<shot>.jpg`,
  so switching the theme swaps all of them, and the captions follow. The gallery in
  "Three themes" is a timed carousel (`data-gallery`): one slide per screen (album,
  library, lyrics), the phone laid over the desktop shot at 90% of its height and 15%
  of its own width of overlap, the phone alone under 44rem. Progress bars under it
  advance every 6.5 s, pause on hover, focus or when off screen, and do not run at all
  under `prefers-reduced-motion`.
- **Cover cloud** — `images/covers.jpg` is the faded wall behind the header and the
  name block: 64 album covers in an 8×8 grid with a 14px gutter, ordered so no artist
  repeats within 8 slots (row or column), exported at 1280×1280 q66 and dimmed in CSS
  (`.covers` — 18%, desaturated, masked off the headline and faded at the bottom).
  Rebuild it from a real library when the wall needs refreshing; keep the gutter and
  the artist spacing, they are what stop it reading as one blurry block.
- **Contact** — the support line at the end copies `hey@nomorenames.studio` to the
  clipboard and confirms with a toast; the `mailto:` href stays only as the no-JS
  fallback.
- **One third-party request** — the Umami beacon on
  `ramen.nomorenames.studio` (`script.js`, ~2 kB). Self-hosted, cookieless, and
  `data-do-not-track="true"` means a visitor who sends that signal is not counted at
  all. `data-domains="juuku.nomorenames.studio"` keeps local previews and the
  `github.io` address out of the stats. Fonts stay self-hosted (SIL OFL, licences
  alongside); there is no CDN.
- **Where the beacon lives** — not in this repo: the website id sits in the
  `ANALYTICS_TAG` repository secret, and `.github/scripts/inject-analytics.mjs`
  writes the tag in before Pages uploads `site/`. It accepts either the bare id or a
  whole `<script>` tag, is idempotent, and no-ops when the secret is absent — so a
  fork or a missing secret deploys an untracked page rather than failing.
- **Run it card** — two routes in one card: `shell` (the docker command) and
  `AI agents` (a prompt an agent can follow). The prompt restates the setup steps and
  points at `docs/SETUP.md` as the source of truth — keep the two in step.
- **Cache busting** — `index.html` loads `style.css?v=N` and `script.js?v=N`. Bump
  that query whenever either file changes, or a returning visitor keeps the old CSS.
- **Accessibility** — text over the cover cloud is the one place contrast can go
  wrong, so a change there is checked by measuring the pixels actually painted behind
  the text, not just axe (axe skips text over background images). Touch targets stay
  at least 24×24; the carousel bars keep their 4px look with a 24px hit area. Nothing
  moves on its own under `prefers-reduced-motion`.

## Regenerating the screenshots

The shots are the real app against a real Navidrome, captured at

| view | viewport | file |
| --- | --- | --- |
| home, album, player (wide) | 1440×900 @2x, resized to 1600×1000 | `images/<theme>/{home,album,player}.jpg` |
| home, album, lyrics (phone) | 390×844 @3x, resized to 780×1688 | `images/<theme>/phone-*.jpg` |

The page uses `home`, `album` and `player` wide, and `phone-home`, `phone-album` and
`phone-lyrics`; `phone-player.jpg` is kept for reuse but nothing points at it.

Playwright drives it: set `localStorage['juuku.theme']` before the first paint, open
`#/home`, `#/album/<id>`, `#/player`, and click `.lyrics-toggle` for the lyrics shot.
Then `magick <png> -resize 1600x1000 -strip -interlace Plane -quality 82 <jpg>`.

Two things to keep out of the capture: a sandbox library of two albums makes a thin
hero (use a real one), and starting playback on the Navidrome someone is listening to
is not a screenshot problem you want.
