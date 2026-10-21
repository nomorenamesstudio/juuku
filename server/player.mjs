import { readdir, unlink } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';

/**
 * Navidrome runs one mpv per track and cannot always reap the old one: when its
 * socket write fails it drops the reference and the orphan keeps playing, so two
 * tracks come out of the speakers. Navidrome gives mpv an IPC socket per player,
 * and `quit` on that socket ends it — this is how juuku kills leftovers instead of
 * asking someone to ssh in.
 *
 * The sockets only work when Navidrome's temp dir is shared with this container
 * (JUUKU_MPV_SOCKETS), and only as the uid mpv runs as: mpv creates them 0600.
 */
const DIR = process.env.JUUKU_MPV_SOCKETS ?? '/mpv-sockets';

export async function listSockets() {
  try {
    const names = await readdir(DIR);
    return names.filter((name) => name.startsWith('mpv-ctrl-') && name.endsWith('.socket')).map((name) => join(DIR, name));
  } catch {
    return [];
  }
}

export const socketsShared = () => process.env.JUUKU_MPV_SOCKETS !== undefined;

/**
 * What a socket file is: a player, a leftover, or someone else's.
 *
 * `unreachable` is the case that used to wreck playback. mpv creates its socket
 * 0600 under its own uid, so a juuku container running as a different user gets
 * EACCES on a socket whose player is very much alive. Counting that as dead let the
 * watchdog delete a live player's socket: Navidrome lost the handle, could not reap
 * it, and the next play spawned a second mpv beside it — the exact double playback
 * this module exists to prevent.
 */
export function probeSocket(path, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = createConnection(path);
    let settled = false;
    const done = (state) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(state);
    };
    socket.setTimeout(timeoutMs, () => done('dead'));
    socket.on('error', (err) => {
      if (err.code === 'EACCES' || err.code === 'EPERM') done('unreachable');
      else done('dead');
    });
    socket.on('connect', () => done('alive'));
  });
}

/** Socket files, and what each one turned out to be. */
export async function socketReport() {
  const sockets = await listSockets();
  const report = { visible: sockets.length, reachable: 0, blocked: 0, dead: 0 };
  for (const path of sockets) {
    const state = await probeSocket(path);
    if (state === 'alive') report.reachable += 1;
    else if (state === 'unreachable') report.blocked += 1;
    else report.dead += 1;
  }
  return report;
}

/** How many players we can actually drive right now. */
export async function livePlayers() {
  return (await socketReport()).reachable;
}

async function drop(path) {
  try {
    await unlink(path);
  } catch {
    // already gone, or not ours to remove
  }
}

/** Send mpv the JSON `quit` command; resolves false when the socket is stale. */
export function quitSocket(path, timeoutMs = 1500) {
  return new Promise((resolve) => {
    let settled = false;
    const socket = createConnection(path);
    const done = (ok) => {
      if (settled) return;
      settled = true;
      // end, not destroy: destroy can drop the command before it is flushed
      if (ok) socket.end();
      else socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.on('error', () => done(false));
    socket.on('connect', () => {
      socket.write(`${JSON.stringify({ command: ['quit'] })}\n`, () => done(true));
    });
  });
}

/**
 * Remove socket files whose player is gone. Only a definitive `dead` is removable:
 * a file we are merely not allowed to open belongs to a player that is still going,
 * and deleting it would cut Navidrome's only handle on it.
 */
export async function dropDeadSockets() {
  const sockets = await listSockets();
  let dropped = 0;
  for (const path of sockets) {
    if ((await probeSocket(path)) === 'dead') {
      await drop(path);
      dropped += 1;
    }
  }
  return dropped;
}

/**
 * Quit every player socket in the shared dir and clear the leftovers: a dead
 * player's socket file would otherwise keep counting as a player. A socket that
 * refuses us is left in place — quitting it is impossible, and unlinking it only
 * hides it.
 */
export async function quitPlayers() {
  const sockets = await listSockets();
  let quit = 0;
  let stale = 0;
  let blocked = 0;
  for (const path of sockets) {
    if (await quitSocket(path)) {
      quit += 1;
      await drop(path);
      continue;
    }
    if ((await probeSocket(path)) === 'unreachable') {
      blocked += 1;
      continue;
    }
    stale += 1;
    await drop(path);
  }
  return { found: sockets.length, quit, stale, blocked };
}
