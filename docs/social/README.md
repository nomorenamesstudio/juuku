# Social cards

The hero's pieces — logo lockup, headline, the faded cover wall, three phone shots —
laid out for three places:

| file | where it goes |
| --- | --- |
| `og-1200x630.jpg` | link previews (Open Graph, Twitter `summary_large_image`) |
| `github-1280x640.jpg` | GitHub repository social preview (Settings → Social preview) |
| `square-1080.jpg` | Reddit, Bluesky, Mastodon, Instagram feed |

`card.html` holds the layout, `make.mjs` renders each size at 2x and halves it, so the
type stays crisp. The phone-stack geometry is the page's: album in front, library and
lyrics behind at 90% of its height, peeking out sideways.

```sh
PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright node docs/social/make.mjs
cd docs/social && for f in *@2x.png; do magick "$f" -resize 50% -quality 90 "${f%@2x.png}.jpg"; done && rm *@2x.png
```

Text lives in `card.html`; the screenshots come from `site/images/mocha/`, so a
regenerated set picks up whatever those show.
