import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanArtist, cleanTitle, parseLrc, pickCandidate, versionMarked } from './lyrics.mjs';

// The player highlights a line by comparing these timestamps against the
// jukebox position, so a wrong unit or a dropped minute desyncs every lyric view
// without failing anywhere else.
test('parseLrc converts LRC timestamps to milliseconds', () => {
  assert.deepEqual(parseLrc('[00:50.56]We are human\n[01:01.00]Much in common'), [
    { time: 50560, text: 'We are human' },
    { time: 61000, text: 'Much in common' },
  ]);
});

test('parseLrc keeps untimed lines and drops blanks', () => {
  assert.deepEqual(parseLrc('Just a line\n\n[00:01.5]After all\n'), [
    { text: 'Just a line' },
    { time: 1500, text: 'After all' },
  ]);
});

// Tags in the library carry featured credits ("Rong feat. Robyn") that LRCLIB does
// not index, so the search fallback depends on these names being stripped.
test('cleanTitle drops featured credits and parentheticals', () => {
  assert.equal(cleanTitle('Rong feat. Robyn'), 'Rong');
  assert.equal(cleanTitle('Monument (The Inevitable End Version)'), 'Monument');
  assert.equal(cleanTitle('Running to the Sea feat. Susanne Sundfør'), 'Running to the Sea');
  assert.equal(cleanTitle('Plain Title'), 'Plain Title');
});

test('cleanArtist keeps the lead artist only', () => {
  assert.equal(cleanArtist('Robyn feat. Röyksopp'), 'Robyn');
  assert.equal(cleanArtist('Röyksopp'), 'Röyksopp');
});

// A search returns many recordings of the same title; picking one by duration is
// what stops a seven-minute remix being shown over a three-minute album track.
test('pickCandidate prefers the recording whose length matches', () => {
  const results = [
    { duration: 400, syncedLyrics: '[00:01.00]remix', plainLyrics: null },
    { duration: 152, syncedLyrics: '[00:01.00]original', plainLyrics: null },
    { duration: 153, syncedLyrics: null, plainLyrics: 'plain' },
  ];
  const best = pickCandidate(results, 152);
  assert.equal(best.entry.syncedLyrics, '[00:01.00]original');
  assert.equal(best.timingTrusted, true);
});

test('pickCandidate marks an off-length result as untrustworthy for timing', () => {
  // the album version is 6:20, this file is 6:41 — the words are right, the
  // timestamps belong to another edit
  const results = [{ duration: 380, plainLyrics: 'words', syncedLyrics: '[00:01.00]x' }];
  const best = pickCandidate(results, 401, 5);
  assert.equal(best.timingTrusted, false, 'a remix of another length must not sync');
  assert.equal(pickCandidate([], 60), null);
});

// A remix album once showed the original track's words against a different
// recording. The clean title drops the marker, so the search would happily match
// the original; only an identical title may supply lyrics for a version.
test('pickCandidate refuses the original when another version is expected', () => {
  const results = [{ trackName: 'Like Eating Grass', duration: 240, syncedLyrics: '[00:01]x' }];
  assert.equal(pickCandidate(results, 240, 3, { expectTitle: 'Like Eating Grass (CSS remix)' }), null);
  assert.ok(pickCandidate(results, 240, 3, { expectTitle: 'Like Eating Grass (Remastered)' }));
});

test('versionMarked only treats bracketed or dashed suffixes as versions', () => {
  assert.equal(versionMarked('Like Eating Grass (CSS remix)'), true);
  assert.equal(versionMarked('Song - Live'), true);
  assert.equal(versionMarked('Live Forever'), false);
  assert.equal(versionMarked('One Month Off [Remastered]'), false);
  assert.equal(versionMarked('Silence'), false);
});
