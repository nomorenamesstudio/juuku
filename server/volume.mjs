import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * The room's volume, remembered across restarts.
 *
 * Navidrome starts every new mpv at full volume, so after a container restart — or
 * after the queue is rebuilt — the next track comes out at 100% no matter where the
 * slider was. Remembering the last level the user chose and putting it back is the
 * difference between a jukebox and a fire alarm.
 */
const DIR = process.env.JUUKU_DATA_DIR ?? '.data';
const FILE = join(DIR, 'volume.json');

/** the last level the user asked for, or null when they never touched it */
let stored = null;

export function lastVolume() {
  return stored;
}

let saving = Promise.resolve();

export async function loadVolume() {
  try {
    const value = JSON.parse(await readFile(FILE, 'utf8'))?.gain;
    if (Number.isFinite(value) && value >= 0 && value <= 1) stored = value;
  } catch {
    // first run or unreadable file: no remembered level, no correction
  }
  return stored;
}

export function rememberVolume(gain) {
  if (!Number.isFinite(gain) || gain < 0 || gain > 1) return;
  stored = gain;
  saving = saving.then(async () => {
    await mkdir(dirname(FILE), { recursive: true });
    const temporary = `${FILE}.tmp`;
    await writeFile(temporary, JSON.stringify({ gain: stored }));
    await rename(temporary, FILE);
  }).catch((err) => console.warn(`volume not saved: ${err.message}`));
  return saving;
}

/**
 * A fresh player reports full volume. Only that exact signature counts — a level the
 * user (or another client) chose must never be overwritten by a remembered one.
 */
export function isVolumeReset(observed) {
  if (stored === null || !Number.isFinite(observed)) return false;
  // whole percent, because 0.99 - 1 is 0.010000000000000009 and a tolerance in floats
  // would quietly miss the common case it exists for
  return Math.round(observed * 100) >= 99 && Math.round(stored * 100) <= 98;
}
