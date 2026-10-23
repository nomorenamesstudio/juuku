import assert from 'node:assert/strict';
import test from 'node:test';
import { clean } from './store.mjs';

// Preferences arrive from a browser, so the store is a trust boundary: unknown keys
// and junk shapes must not reach the file that every device hydrates from.
test('clean drops keys the client does not own', () => {
  assert.deepEqual(clean({ 'juuku.settings': { lyricLeadMs: 400 }, evil: 'x' }), {
    'juuku.settings': { lyricLeadMs: 400, lyricsLookup: false },
  });
});

test('clean clamps the lyric lead and keeps only real search entries', () => {
  const out = clean({
    'juuku.settings': { lyricLeadMs: 99999 },
    'juuku.search.recent': [{ kind: 'album', id: 'a', name: 'A' }, { kind: 'song', id: 'b' }, { id: 'c' }],
    'juuku.library.sort': 'byGenre',
  });
  assert.equal(out['juuku.settings'].lyricLeadMs, 2000);
  assert.deepEqual(out['juuku.search.recent'].map((entry) => entry.id), ['a']);
  assert.equal(out['juuku.library.sort'], 'newest');
});

test('the dismissed update is a version string or nothing at all', () => {
  assert.equal(clean({ 'juuku.update.dismissed': '0.8.13' })['juuku.update.dismissed'], '0.8.13');
  assert.equal(clean({ 'juuku.update.dismissed': 'v0.8.13' })['juuku.update.dismissed'], '0.8.13');
  // junk would hide every future release, so it is dropped rather than stored
  assert.equal(clean({ 'juuku.update.dismissed': 'yes' })['juuku.update.dismissed'], undefined);
  assert.equal(clean({ 'juuku.update.dismissed': 42 })['juuku.update.dismissed'], undefined);
});
