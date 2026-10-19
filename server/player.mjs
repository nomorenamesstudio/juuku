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
 * (JUUKU_MPV_SOCKETS), and only as root: mpv creates them 0600.
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

/** A socket file can outlive its player: only a connect says whether it is alive. */
export function probeSocket(path, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = createConnection(path);
    let settled = false;
    const done = (alive) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(alive);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.on('error', () => done(false));
    socket.on('connect', () => done(true));
  });
}

/** How many players are actually alive right now. */
export async function livePlayers() {
  const sockets = await listSockets();
  let live = 0;
  for (const path of sockets) {
    if (await probeSocket(path)) live += 1;
  }
  return live;
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

/** Remove socket files whose player is gone; never touches a live one. */
export async function dropDeadSockets() {
  const sockets = await listSockets();
  let dropped = 0;
  for (const path of sockets) {
    if (!(await probeSocket(path))) {
      await drop(path);
      dropped += 1;
    }
  }
  return dropped;
}

/**
 * Quit every player socket in the shared dir and clear the leftovers: a dead
 * player's socket file would otherwise keep counting as a player.
 */
export async function quitPlayers() {
  const sockets = await listSockets();
  let quit = 0;
  let stale = 0;
  for (const path of sockets) {
    if (await quitSocket(path)) quit += 1;
    else stale += 1;
    await drop(path);
  }
  return { found: sockets.length, quit, stale };
}
