#!/usr/bin/env python3
"""Write public/logo.svg: the app's wordmark as outlines, so it scales anywhere.

The numbers are the ones the app actually renders with, measured in the browser at
the topbar size (latin 25.6px, kana 10.56px) and multiplied by SCALE here:

    latin   Instrument Serif 25.6px, colour --cream, tracking -0.01em, baseline 21
    kana    Noto Sans JP 600 10.56px, colour --muted, tracking 0.14em, baseline 34.859
    LED     8px dot, 7.1875px after the name, vertically centred on the lockup

Both faces are self-hosted in public/fonts, so the outlines are the same glyphs the
app draws. Re-run after changing those sizes.
"""
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SCALE = 10

LATIN = dict(path=ROOT / 'public/fonts/instrument-serif.woff2', text='juuku', size=25.6,
             tracking=-0.01, baseline=21.0, fill='#f4ead9')
KANA = dict(path=ROOT / 'public/fonts/noto-sans-jp-kana.woff2', text='ジューク', size=10.56,
            tracking=0.14, baseline=34.859375, fill='#b6a68c')
# glow 1.6x the dot matches the app's 0 0 10px box-shadow; the box is padded to
# 2.2x so the fade never hits the viewBox edge
LED = dict(size=8.0, gap=7.1875, center_y=18.703125, fill='#f0a24a', glow=1.6, pad=2.2)
DOT_X = 52.375 + LED['gap'] + LED['size'] / 2
# the viewBox has to fit the glow too, or its right side gets sliced straight
WIDTH = DOT_X + LED['size'] * LED['pad']
HEIGHT = max(37.44, LED['center_y'] + LED['size'] * LED['pad'])


def outlines(spec):
    font = TTFont(spec['path'])
    units = font['head'].unitsPerEm
    scale = spec['size'] / units
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    tracking = spec['tracking'] * spec['size']

    paths, cursor = [], 0.0
    for index, char in enumerate(spec['text']):
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphs)
        # flip y (font units are y-up) and land the baseline where the app puts it
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, spec['baseline'])))
        paths.append(pen.getCommands())
        cursor += glyphs[name].width * scale
        if index < len(spec['text']) - 1:
            cursor += tracking
    return paths


def group(spec):
    body = ''.join(paths for paths in outlines(spec) if paths)
    return f'  <g fill="{spec["fill"]}"><path d="{body}"/></g>'


def build():
    dot_x = DOT_X
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH * SCALE:.3f} {HEIGHT * SCALE:.3f}" role="img" aria-label="Juuku">
  <defs>
    <radialGradient id="led-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="{LED["fill"]}" stop-opacity="0.7"/>
      <stop offset="1" stop-color="{LED["fill"]}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <g transform="scale({SCALE})">
{group(LATIN)}
{group(KANA)}
    <circle cx="{dot_x:.4f}" cy="{LED["center_y"]:.4f}" r="{LED["size"] * LED["glow"]:.4f}" fill="url(#led-glow)"/>
    <circle cx="{dot_x:.4f}" cy="{LED["center_y"]:.4f}" r="{LED["size"] / 2:.4f}" fill="{LED["fill"]}"/>
  </g>
</svg>
'''


if __name__ == '__main__':
    target = ROOT / 'public/logo.svg'
    target.write_text(build())
    print(f'wrote {target.relative_to(ROOT)} ({target.stat().st_size} bytes)')
