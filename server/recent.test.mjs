import assert from 'node:assert/strict';
import test from 'node:test';
import { albumThatPlayed, bump, queueStillOurs, resolvePlaylist } from './recent.mjs';

// The home screen's history rows: the thing that just played goes to the front, appears
// once, and the list stays bounded. Both album and playlist logs go through this, so a
// mistake here shows up as a duplicated or missing row on Home.
test('bump moves a value to the front without duplicating it', () => {
  const list = ['a', 'b', 'c'];
  bump(list, 'c', 3);
  assert.deepEqual(list, ['c', 'a', 'b']);

  // a new value enters at the front
  bump(list, 'd', 3);
  assert.deepEqual(list, ['d', 'c', 'a'], 'the oldest entry falls off the end');

  // repeating the front value is a no-op rather than a second copy
  bump(list, 'd', 3);
  assert.deepEqual(list, ['d', 'c', 'a']);

  // nothing to record
  bump(list, '', 3);
  bump(list, undefined, 3);
  assert.deepEqual(list, ['d', 'c', 'a']);
});

// His importer recreates playlists, which gives them a new Navidrome id. The history
// row lost every such playlist while the log held ids only.
test('a played playlist is found by id, then by name after a recreation', () => {
  const byId = new Map([['new', { id: 'new', name: 'This Is Zagar' }]]);
  const byName = new Map([['This Is Zagar', { id: 'new', name: 'This Is Zagar' }]]);

  // the id still exists: that is the playlist
  assert.deepEqual(resolvePlaylist({ id: 'new', name: 'This Is Zagar' }, byId, byName), {
    entry: { id: 'new', name: 'This Is Zagar' },
  });

  // recreated: the old id is gone, the name still points at the new one
  assert.deepEqual(resolvePlaylist({ id: 'old', name: 'This Is Zagar' }, byId, byName), {
    entry: { id: 'new', name: 'This Is Zagar' },
  });

  // deleted, with a name: the row may still say what it was
  assert.deepEqual(resolvePlaylist({ id: 'gone', name: 'Mixtape' }, byId, byName), {
    missing: { id: 'gone', name: 'Mixtape' },
  });

  // an entry from the id-only era cannot be shown at all
  assert.equal(resolvePlaylist({ id: 'gone', name: null }, byId, byName), null);
});

// "Last played albums" means albums put on, so a playlist's tracks belong to the
// playlist row instead of scattering every album it touched into the album history.
test('the album row records the track that finished', () => {
  const playing = (index, playing_ = true) => ({
    status: { currentIndex: index, playing: playing_ },
    entries: [{ albumId: 'first' }, { albumId: 'second' }],
  });
  const album = () => false;

  assert.equal(albumThatPlayed(playing(0), playing(1), album), 'first', 'a track change records the album that played');
  assert.equal(albumThatPlayed(playing(0), playing(0), album), null, 'the same track twice is not a play');
  assert.equal(albumThatPlayed(playing(0), playing(0, false), album), 'first', 'stopping records it too');
  assert.equal(albumThatPlayed(playing(1), playing(1), album), null, 'no album on the entry, nothing to record');
});

// A playlist's tracks must not reach "Last played albums" — but an album queued behind a
// playlist must, so the decision belongs to the track that finished, not to the queue.
test('the album row follows the track, not the queue', () => {
  const state = (id, albumId = 'album-1') => ({
    status: { currentIndex: 0, playing: true },
    entries: [{ id, albumId }],
  });
  const nothing = () => false;

  assert.equal(albumThatPlayed(state('from-playlist'), null, () => true), null, 'a playlist track is the playlist row');
  assert.equal(albumThatPlayed(state('from-album'), null, () => false), 'album-1', 'an album queued behind a playlist still counts');
  assert.equal(albumThatPlayed(state('x'), null, nothing), 'album-1', 'and the default records as before');
});

test('the queue marker notices another client taking over', () => {
  const queue = (...ids) => ({ entries: ids.map((id) => ({ id })) });
  assert.equal(queueStillOurs(queue('a', 'b'), 'a'), true);
  assert.equal(queueStillOurs(queue('a', 'b'), 'c'), false, 'a different queue is not ours');
  assert.equal(queueStillOurs(queue(), 'a'), false, 'an empty queue is not ours');
  assert.equal(queueStillOurs(queue('a'), null), false, 'no marker, nothing to hold on to');
  assert.equal(queueStillOurs(null, 'a'), false);
});
