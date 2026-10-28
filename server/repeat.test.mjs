import assert from 'node:assert/strict';
import test from 'node:test';
import { repeatAtEnd } from './repeat.mjs';

// Repeat used to need an open client: with the phone in a pocket the queue ran out and
// stayed silent until the app came back. The server now decides, so the decision is
// where a wrong answer is audible — a queue restarted mid-track, or a stop mistaken for
// an end.

const state = ({ playing = false, index = 2, position = 0, length = 3 } = {}) => ({
  status: { playing, currentIndex: index, position },
  entries: Array.from({ length }, (_, i) => ({ id: `t${i}` })),
});

test('the end of the queue wraps when repeat is on', () => {
  assert.equal(repeatAtEnd('all', state()), 0, 'repeat-all goes back to the start');
  assert.equal(repeatAtEnd('one', state()), 2, 'repeat-one replays the last track');
});

test('a stop is not an end', () => {
  assert.equal(repeatAtEnd('all', state({ index: 1 })), null, 'stopped mid-queue is a stop');
  assert.equal(repeatAtEnd('all', state({ position: 47 })), null, 'stopped with a position is a stop');
  assert.equal(repeatAtEnd('all', state({ playing: true })), null, 'still playing, nothing due');
});

test('repeat off never restarts, and an empty queue has nothing to repeat', () => {
  assert.equal(repeatAtEnd('off', state()), null);
  assert.equal(repeatAtEnd('all', state({ length: 0, index: -1 })), null);
  assert.equal(repeatAtEnd('all', null), null);
});
