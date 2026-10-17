import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLrc } from './lyrics.mjs';

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
