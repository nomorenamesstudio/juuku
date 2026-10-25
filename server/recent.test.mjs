import assert from 'node:assert/strict';
import test from 'node:test';
import { albumThatPlayed, bump, queueStillFromPlaylist, resolvePlaylist } from './recent.mjs';

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
test('the album row ignores a queue a playlist started', () => {
  const playing = (index, playing_ = true) => ({
    status: { currentIndex: index, playing: playing_ },
    entries: [{ albumId: 'first' }, { albumId: 'second' }],
  });

  assert.equal(albumThatPlayed(playing(0), playing(1), false), 'first', 'a track change records the album that played');
  assert.equal(albumThatPlayed(playing(0), playing(0), false), null, 'the same track twice is not a play');
  assert.equal(albumThatPlayed(playing(0), playing(0, false), false), 'first', 'stopping records it too');
  assert.equal(albumThatPlayed(playing(1), playing(1), false), null, 'no album on the entry, nothing to record');

  assert.equal(albumThatPlayed(playing(0), playing(1), true), null, 'a playlist queue records no albums');
  assert.equal(albumThatPlayed(playing(0), playing(0, false), true), null, 'not even when it stops');
});

// The flag that keeps a playlist's tracks out of "Last played albums" has to survive the
// container that recorded it, and has to give way when another client replaces the queue.
test('the playlist marker follows the queue, not the container', () => {
  const queue = (...ids) => ({ entries: ids.map((id) => ({ id })) });
  assert.equal(queueStillFromPlaylist(queue('a', 'b'), 'a'), true);
  assert.equal(queueStillFromPlaylist(queue('a', 'b'), 'c'), false, 'a different queue is not the playlist');
  assert.equal(queueStillFromPlaylist(queue(), 'a'), false, 'an empty queue is not the playlist');
  assert.equal(queueStillFromPlaylist(queue('a'), null), false, 'no marker, nothing to hold on to');
  assert.equal(queueStillFromPlaylist(null, 'a'), false);
});
