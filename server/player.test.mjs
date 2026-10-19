import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { quitSocket } from './player.mjs';

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
