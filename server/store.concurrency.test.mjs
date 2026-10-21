import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// The store keeps every account's preferences in one JSON file, so saves that arrive
// together must all land. Two ways they did not: the "already loaded?" check sat
// before the await, so each concurrent caller built its own store and every patch but
// the last went into an object nobody read again; and every save used the same `.tmp`
// path, so the loser's rename failed with ENOENT. Measured on a slowed filesystem: 20
// concurrent saves lost 19 updates and 16 of them rejected.
test('concurrent preference saves all land in one intact file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'juuku-store-'));
  process.env.JUUKU_DATA_DIR = dir;
  try {
    const { putProfile } = await import('./store.mjs');
    const users = Array.from({ length: 20 }, (_, index) => `user${index}`);

    const results = await Promise.allSettled(
      users.map((user) => putProfile(user, { 'juuku.library.sort': 'byYear' })),
    );
    const failed = results.filter((result) => result.status === 'rejected');
    assert.deepEqual(
      failed.map((result) => result.reason?.message),
      [],
      'no save may fail while another one is writing',
    );

    const saved = JSON.parse(await readFile(join(dir, 'prefs.json'), 'utf8'));
    assert.deepEqual(Object.keys(saved.profiles).sort(), [...users].sort(), 'every account that saved is in the file');
    assert.equal(saved.profiles.user0['juuku.library.sort'], 'byYear', 'the patch itself reached the file');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
