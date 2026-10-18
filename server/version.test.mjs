import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// __APP_VERSION__ comes from package.json, and the Settings page shows it to the
// user, so a release that bumps the changelog and the tag but forgets package.json
// ships a build that lies about itself. That happened for three releases.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const changelog = readFileSync(new URL('../docs/CHANGELOG.md', import.meta.url), 'utf8');

test('the changelog version and package.json agree', () => {
  const newest = changelog.match(/^## v(\d+\.\d+\.\d+)/m);
  assert.ok(newest, 'the changelog has a version heading');
  assert.equal(newest[1], pkg.version, 'docs/CHANGELOG.md releases are current');
});
