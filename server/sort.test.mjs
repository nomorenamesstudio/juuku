import assert from 'node:assert/strict';
import test from 'node:test';
import { alphabeticalBy, compareAlphabetical, sortKey } from './sort.mjs';

test('sortKey starts at the first letter or digit', () => {
  assert.equal(sortKey('"Heroes"'), 'Heroes"');
  assert.equal(sortKey('…I Care Because You Do'), 'I Care Because You Do');
  assert.equal(sortKey('(What’s the Story) Morning Glory?'), 'What’s the Story) Morning Glory?');
  assert.equal(sortKey('10.000 Days'), '10.000 Days');
  assert.equal(sortKey('!!!'), '');
  assert.equal(sortKey(''), '');
});

test('compareAlphabetical ignores decoration and folds accents', () => {
  const names = ['"Heroes"', '…I Care Because You Do', '10.000 Days', 'Ágætis byrjun', 'Kid A', '!!!'];
  const sorted = [...names].sort(compareAlphabetical);
  assert.deepEqual(sorted, ['!!!', '10.000 Days', 'Ágætis byrjun', '"Heroes"', '…I Care Because You Do', 'Kid A']);
});

test('alphabeticalBy sorts a list of records by the given field', () => {
  const albums = [{ name: '…I Care Because You Do' }, { name: '"Heroes"' }, { name: 'Selected Ambient Works' }];
  assert.deepEqual(
    alphabeticalBy(albums, 'name').map((album) => album.name),
    ['"Heroes"', '…I Care Because You Do', 'Selected Ambient Works'],
  );
});
