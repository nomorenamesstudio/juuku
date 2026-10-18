/**
 * Preferences live on the server, keyed by the Navidrome account, so a phone and a
 * desktop share them and a redeploy does not wipe them. localStorage stays as the
 * instant copy: it paints the right values before the first request returns.
 */
const DEBOUNCE_MS = 400;

let timer: number | undefined;
let pending: Record<string, unknown> = {};

function flush() {
  const body = { prefs: pending };
  pending = {};
  void fetch('api/prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    // offline: localStorage still has it, the next write retries
  });
}

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode: the session keeps the value in memory
  }
  pending[key] = value;
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, DEBOUNCE_MS);
}

/** Pull the account's preferences down and make them the local copy. */
export async function hydratePrefs(): Promise<void> {
  try {
    const response = await fetch('api/prefs');
    if (!response.ok) return;
    const { prefs } = (await response.json()) as { prefs: Record<string, unknown> };
    for (const [key, value] of Object.entries(prefs ?? {})) {
      if (value === null || value === undefined) continue;
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // first run offline: the local copy is all there is
  }
}
