import { readFileSync } from 'node:fs';

/**
 * "Is there a newer Juuku?" — one call to GitHub's public API, cached for hours.
 *
 * The repo publishes a tag on every release (that is what the image workflow builds
 * from), and only the first few versions ever got a GitHub *release*, so tags are the
 * honest signal here; the releases endpoint is the fallback for a repo that stops
 * tagging.
 */
const REPO = 'https://api.github.com/repos/nomorenamesstudio/juuku';
const TAGS = `${REPO}/tags?per_page=30`;
const LATEST_RELEASE = `${REPO}/releases/latest`;
const CHECK_MS = 6 * 60 * 60 * 1000;
export const UPDATE_DOCS = 'https://github.com/nomorenamesstudio/juuku/blob/main/docs/SETUP.md#updating';

/** "v0.8.12" or "0.8.12" -> [0, 8, 12]; anything else -> null */
export function parseVersion(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(text ?? '').trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** true only when `latest` is strictly newer than `current` */
export function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

/** the highest version among tag names, or null when none parse */
export function highestVersion(names) {
  let best = null;
  for (const name of names ?? []) {
    const parsed = parseVersion(name);
    if (!parsed) continue;
    if (!best || isNewer(name, best)) best = name.replace(/^v/, '');
  }
  return best;
}

export function currentVersion() {
  const override = process.env.JUUKU_VERSION;
  if (override) return override.replace(/^v/, '');
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const enabled = () => (process.env.JUUKU_UPDATE_CHECK ?? 'on').toLowerCase() !== 'off';

let cache = { at: 0, latest: null };

/** for tests: forget the cached answer */
export function forgetVersionCheck() {
  cache = { at: 0, latest: null };
}

async function fetchLatest() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'juuku-update-check' };
  const tags = await fetch(TAGS, { headers });
  if (tags.ok) {
    const list = await tags.json();
    const highest = highestVersion(Array.isArray(list) ? list.map((tag) => tag?.name) : []);
    if (highest) return highest;
  }
  const release = await fetch(LATEST_RELEASE, { headers });
  if (!release.ok) throw new Error(`GitHub answered ${release.status}`);
  return highestVersion([(await release.json())?.tag_name]) ?? null;
}

/**
 * Never throws: an offline box or a rate limit means "unknown", not a broken app.
 */
export async function updateInfo() {
  const current = currentVersion();
  if (!enabled()) {
    return { current, latest: null, updateAvailable: false, url: UPDATE_DOCS, checkedAt: null };
  }
  if (Date.now() - cache.at > CHECK_MS) {
    cache = { at: Date.now(), latest: cache.latest };
    try {
      const latest = await fetchLatest();
      cache = { at: Date.now(), latest };
    } catch (err) {
      // keep whatever we knew, but still wait out the interval: a box that cannot
      // reach GitHub must not pay for a failed call on every page load
      cache = { at: Date.now(), latest: cache.latest };
      console.warn(`update check failed: ${err.message}`);
    }
  }
  return {
    current,
    latest: cache.latest,
    updateAvailable: Boolean(cache.latest && isNewer(cache.latest, current)),
    url: UPDATE_DOCS,
    checkedAt: cache.at ? new Date(cache.at).toISOString() : null,
  };
}
