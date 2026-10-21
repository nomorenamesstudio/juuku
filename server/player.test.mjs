import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { probeSocket, quitSocket } from './player.mjs';

// The kill switch leans on mpv's own IPC protocol, so the wire format matters: a
// wrong command leaves the orphan playing and looks like the feature did nothing.
test('quitSocket sends mpv the quit command over a unix socket', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'juuku-mpv-'));
  const path = join(dir, 'mpv-ctrl-test.socket');
  const received = [];
  let sawData;
  const gotData = new Promise((resolve) => {
    sawData = resolve;
  });

  const server = createServer((socket) => {
    socket.on('data', (chunk) => {
      received.push(chunk.toString());
      sawData();
    });
  });
  await new Promise((resolve) => server.listen(path, resolve));

  assert.equal(await quitSocket(path), true);
  await gotData;
  assert.match(received.join(''), /"command":\["quit"\]/);

  server.close();
  await rm(dir, { recursive: true, force: true });
});

test('quitSocket reports a stale socket instead of throwing', async () => {
  assert.equal(await quitSocket(join(tmpdir(), 'no-such-mpv.socket')), false);
});

test('probeSocket tells a live player from a leftover', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'juuku-probe-'));
  const path = join(dir, 'mpv-ctrl-probe.socket');
  const server = createServer(() => {});
  await new Promise((resolve) => server.listen(path, resolve));

  assert.equal(await probeSocket(path), 'alive');
  await new Promise((resolve) => server.close(resolve));
  // the file may remain, but nothing answers on it any more
  assert.equal(await probeSocket(path), 'dead');

  await rm(dir, { recursive: true, force: true });
});

// mpv creates its socket 0600 under its own uid, so a juuku container running as a
// different user is refused by a player that is very much alive. Treating that as
// dead let the watchdog delete the socket: Navidrome lost its handle, could not reap
// the player, and the next play started a second mpv beside it.
test('a socket we are not allowed to open is unreachable, not dead', { skip: process.getuid?.() === 0 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'juuku-locked-'));
  const path = join(dir, 'mpv-ctrl-locked.socket');
  const server = createServer(() => {});
  await new Promise((resolve) => server.listen(path, resolve));
  await chmod(path, 0o000);

  assert.equal(await probeSocket(path), 'unreachable');

  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});
