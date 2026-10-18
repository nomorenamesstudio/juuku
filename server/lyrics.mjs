/** LRC text -> timed lines; lines without a timestamp come through untimed. */
export function parseLrc(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const match = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    if (match) {
      const time = (Number(match[1]) * 60 + Number(match[2])) * 1000;
      lines.push({ time: Math.round(time), text: match[3] });
    } else if (raw.trim()) {
      lines.push({ text: raw.trim() });
    }
  }
  return lines;
}

/** "Rong feat. Robyn (Radio Edit)" -> "Rong": what LRCLIB actually indexes. */
export function cleanTitle(title) {
  return String(title ?? '')
    .replace(/\s*[(\[].*?[)\]]\s*/g, ' ') // parentheticals: (Radio Edit), [Remastered]
    .replace(/\s+(?:feat\.?|ft\.?|featuring|with)\s+.*$/i, '') // featured credits
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** "Robyn feat. Röyksopp" -> "Robyn" */
export function cleanArtist(artist) {
  return String(artist ?? '')
    .replace(/\s+(?:feat\.?|ft\.?|featuring|with)\s+.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * A remixed, edited or live version runs on another timeline and often carries no
 * lyrics of its own, so the words of the original do not belong on it.
 */
const VERSION_WORDS = /re-?mix|rmx|dub|edit|bootleg|rework|remodel|version|mix|instrumental|karaoke|acoustic|live|reprise|demo/i;

export function versionMarked(title) {
  // only a bracketed or dash-separated suffix counts: "Live Forever" is a title,
  // "… (Live)" is a different recording with different words
  const segments = String(title ?? '').match(/[[(][^\])]*[\])]|\s[-–—]\s.*$/g) ?? [];
  return segments.some((segment) => VERSION_WORDS.test(segment));
}

/**
 * Titles are the same recording when only the remaster-ish noise differs: keep
 * every other parenthetical, because "(CSS remix)" is exactly what must not match.
 */
export function sameTitle(a, b) {
  const normalise = (value) =>
    String(value ?? '')
      .replace(/\s*[([][^)\]]*\b(?:remaster(?:ed)?|deluxe|expanded|anniversary|\d{4})\b[^)\]]*[)\]]\s*/gi, ' ')
      .replace(/\s+(?:feat\.?|ft\.?|featuring|with)\s+.*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .toLowerCase();
  return normalise(a) === normalise(b);
}

/**
 * Pick the LRCLIB search result that is plausibly this recording: inside `tolerance`
 * seconds of the file's duration when one is known, preferring synced lyrics. With
 * `expectTitle` a result only counts when it is that same title.
 */
export function pickCandidate(results, duration, tolerance = 5, { expectTitle } = {}) {
  if (!Array.isArray(results) || !results.length) return null;
  const usable = results
    .filter((entry) => entry && (entry.syncedLyrics || entry.plainLyrics))
    .filter((entry) => !expectTitle || sameTitle(entry.trackName ?? entry.title ?? '', expectTitle));
  const inRange = duration
    ? usable.filter((entry) => typeof entry.duration === 'number' && Math.abs(entry.duration - duration) <= tolerance)
    : usable;
  const entry = (inRange.length ? inRange : usable).find((candidate) => candidate.syncedLyrics) ??
    (inRange.length ? inRange : usable)[0] ??
    null;
  if (!entry) return null;
  // a remix runs a different timeline: its timestamps would drift against this file
  const timingTrusted = !duration || (typeof entry.duration === 'number' && Math.abs(entry.duration - duration) <= tolerance);
  return { entry, timingTrusted };
}
