import { readdir } from 'node:fs/promises';
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

/** Quit every player socket still in the shared dir. */
export async function quitPlayers() {
  const sockets = await listSockets();
  let quit = 0;
  for (const path of sockets) {
    if (await quitSocket(path)) quit += 1;
  }
  return { found: sockets.length, quit };
}
