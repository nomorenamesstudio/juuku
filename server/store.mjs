import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Per-account preferences that outlive the container and follow a person across
 * devices. The signed-in Navidrome account is the key, so the same file keeps
 * working when the app learns to log people in individually.
 *
 * Keys are the ones the client already used in localStorage, so a browser that
 * has been around keeps working: it hydrates from here and every write goes back.
 */
const DATA_DIR = process.env.JUUKU_DATA_DIR ?? '.data';
const FILE = join(DATA_DIR, 'prefs.json');

const DEFAULT_PROFILE = { 'juuku.settings': null, 'juuku.search.recent': [], 'juuku.library.sort': 'newest' };

let store = null;
let loading = null;

async function readStore() {
  try {
    store = JSON.parse(await readFile(FILE, 'utf8'));
  } catch {
    store = { version: 1, profiles: {} };
  }
  if (!store.profiles) store = { version: 1, profiles: {} };
  return store;
}

/**
 * One load, however many requests arrive at once. This used to test `store` before
 * awaiting the file, so twenty concurrent first calls all missed, built twenty
 * separate stores and kept only the last — every other patch was written into an
 * object nobody read again.
 */
function load() {
  loading ??= readStore();
  return loading;
}

/**
 * One write at a time. Every save uses the same `.tmp` path, so two overlapping
 * requests (a phone and a desktop both saving a setting) interleaved on it: the
 * loser's rename failed, or the file was renamed mid-write.
 */
let saving = Promise.resolve();

function persist() {
  const run = saving.then(async () => {
    await mkdir(dirname(FILE), { recursive: true });
    const temporary = `${FILE}.tmp`;
    await writeFile(temporary, JSON.stringify(store, null, 2));
    await rename(temporary, FILE);
  });
  saving = run.catch(() => {});
  return run;
}

/** Only the keys the client owns, and only in shapes it can read back. */
export function clean(patch) {
  const out = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (key === 'juuku.settings' && value && typeof value === 'object') {
      const { lyricLeadMs, lyricsLookup } = value;
      out[key] = {
        lyricLeadMs: Number.isFinite(lyricLeadMs) ? Math.min(2000, Math.max(0, Number(lyricLeadMs))) : 400,
        lyricsLookup: lyricsLookup === true,
      };
    } else if (key === 'juuku.search.recent' && Array.isArray(value)) {
      out[key] = value
        .filter((entry) => entry && typeof entry.id === 'string' && (entry.kind === 'album' || entry.kind === 'artist'))
        .slice(0, 10);
    } else if (key === 'juuku.library.sort' && typeof value === 'string') {
      out[key] = ['alphabeticalByName', 'alphabeticalByArtist', 'newest', 'recent', 'byYear'].includes(value)
        ? value
        : 'newest';
    }
  }
  return out;
}

export async function getProfile(user) {
  const data = await load();
  return { ...DEFAULT_PROFILE, ...(data.profiles[user] ?? {}) };
}

export async function putProfile(user, patch) {
  const data = await load();
  const merged = { ...DEFAULT_PROFILE, ...(data.profiles[user] ?? {}), ...clean(patch) };
  data.profiles[user] = merged;
  await persist();
  return merged;
}
