import assert from 'node:assert/strict';
import test from 'node:test';
import { clean } from './store.mjs';

// Preferences arrive from a browser, so the store is a trust boundary: unknown keys
// and junk shapes must not reach the file that every device hydrates from.
test('clean drops keys the client does not own', () => {
  assert.deepEqual(clean({ 'juuku.settings': { lyricLeadMs: 400 }, evil: 'x' }), {
    'juuku.settings': { lyricLeadMs: 400, lyricFont: 'sans', lyricsLookup: false },
  });
});

test('clean clamps the lyric lead and keeps only real search entries', () => {
  const out = clean({
    'juuku.settings': { lyricLeadMs: 99999, lyricFont: 'comic' },
    'juuku.search.recent': [{ kind: 'album', id: 'a', name: 'A' }, { kind: 'song', id: 'b' }, { id: 'c' }],
    'juuku.library.sort': 'byGenre',
  });
  assert.equal(out['juuku.settings'].lyricLeadMs, 2000);
  assert.equal(out['juuku.settings'].lyricFont, 'sans');
  assert.deepEqual(out['juuku.search.recent'].map((entry) => entry.id), ['a']);
  assert.equal(out['juuku.library.sort'], 'newest');
});
