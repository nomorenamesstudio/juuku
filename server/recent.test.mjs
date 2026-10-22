import assert from 'node:assert/strict';
import test from 'node:test';
import { bump } from './recent.mjs';

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
