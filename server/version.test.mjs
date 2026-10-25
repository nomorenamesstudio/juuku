import assert from 'node:assert/strict';
import test from 'node:test';
import { forgetVersionCheck, highestVersion, isNewer, parseVersion, releaseUrl, updateInfo } from './version.mjs';

// The dot on the cog is the only thing standing between him and a stale container, so
// the comparison has to be right: a tag that sorts above the running version means an
// update exists, and nothing else does.

test('versions compare numerically, not as strings', () => {
  assert.deepEqual(parseVersion('v0.8.12'), [0, 8, 12]);
  assert.deepEqual(parseVersion('0.9.0'), [0, 9, 0]);
  assert.equal(parseVersion('latest'), null);

  assert.equal(isNewer('0.8.12', '0.8.9'), true, '12 beats 9 — a string sort would say otherwise');
  assert.equal(isNewer('0.9.0', '0.8.12'), true);
  assert.equal(isNewer('1.0.0', '0.99.99'), true);
  assert.equal(isNewer('0.8.12', '0.8.12'), false, 'the same version is not an update');
  assert.equal(isNewer('0.8.11', '0.8.12'), false, 'an older tag is not an update');
  assert.equal(isNewer('nightly', '0.8.12'), false, 'an unparseable tag is not an update');

  // tags arrive in commit order, so the answer is the highest, not the first
  assert.equal(highestVersion(['v0.8.10', 'v0.8.9', 'v0.8.12', 'nonsense']), '0.8.12');
  assert.equal(highestVersion([]), null);
});

test('an update check that cannot reach GitHub is unknown, not broken', async () => {
  const realFetch = globalThis.fetch;
  const realVersion = process.env.JUUKU_VERSION;
  process.env.JUUKU_VERSION = '0.8.2';

  try {
    // the tags endpoint answers with a newer tag
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => [{ name: 'v0.8.12' }, { name: 'v0.8.9' }] });
    forgetVersionCheck();
    const fresh = await updateInfo();
    assert.equal(fresh.current, '0.8.2');
    assert.equal(fresh.latest, '0.8.12');
    assert.equal(fresh.updateAvailable, true);
    // the banner sends you to what changed, not to the setup guide
    assert.equal(fresh.url, 'https://github.com/nomorenamesstudio/juuku/releases/tag/v0.8.12');

    // now GitHub is unreachable: the answer is "no update known", never a throw
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    forgetVersionCheck();
    const offline = await updateInfo();
    assert.equal(offline.updateAvailable, false);
    assert.equal(offline.latest, null);
    assert.match(offline.url, /SETUP\.md#updating$/, 'nothing to link to, so the instructions');

    // and the switch turns the whole thing off
    process.env.JUUKU_UPDATE_CHECK = 'off';
    forgetVersionCheck();
    const off = await updateInfo();
    assert.equal(off.updateAvailable, false);
    assert.equal(off.checkedAt, null);
  } finally {
    delete process.env.JUUKU_UPDATE_CHECK;
    process.env.JUUKU_VERSION = realVersion ?? '';
    if (!realVersion) delete process.env.JUUKU_VERSION;
    globalThis.fetch = realFetch;
    forgetVersionCheck();
  }
});

// the banner links here, so the shape matters: a tag page, normalised, never a bare version
test('the update link is that version\'s release page', () => {
  assert.equal(releaseUrl('0.9.2'), 'https://github.com/nomorenamesstudio/juuku/releases/tag/v0.9.2');
  assert.equal(releaseUrl('v0.9.2'), 'https://github.com/nomorenamesstudio/juuku/releases/tag/v0.9.2', 'a v prefix is not doubled');
  assert.equal(releaseUrl('nightly'), 'https://github.com/nomorenamesstudio/juuku/releases/tag/vnightly', 'junk still makes a link');
});
