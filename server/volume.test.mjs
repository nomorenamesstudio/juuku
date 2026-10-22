import assert from 'node:assert/strict';
import test from 'node:test';

// Navidrome starts every new mpv at full volume, so the remembered level has to be put
// back after a restart — that is the whole contract here, and it must never fire on a
// level somebody actually chose.
test('a fresh player at full volume is restored, a chosen level is not touched', async () => {
  const fs = await import('node:fs/promises');
  // the data dir is read when the module loads, so point it somewhere disposable first
  const dir = await fs.mkdtemp('/tmp/juuku-volume-');
  process.env.JUUKU_DATA_DIR = dir;
  const { isVolumeReset, lastVolume, loadVolume, rememberVolume } = await import('./volume.mjs');

  assert.equal(lastVolume(), null, 'nothing remembered yet');
  assert.equal(isVolumeReset(1), false, 'no correction without a remembered level');

  await rememberVolume(0.35);   // resolves once the file is written
  assert.equal(lastVolume(), 0.35);
  assert.equal(isVolumeReset(1), true, 'a player that reset to 100% gets corrected');
  assert.equal(isVolumeReset(0.99), true, 'float noise from Navidrome still counts');
  assert.equal(isVolumeReset(0.8), false, 'somebody turned it down: hands off');
  assert.equal(isVolumeReset(0), false, 'muted is muted');

  // the level survives a restart of the process
  const reread = await loadVolume();
  assert.equal(reread, 0.35);

  // full volume as the remembered level means there is nothing to restore
  await rememberVolume(1);
  assert.equal(isVolumeReset(1), false);

  await fs.rm(dir, { recursive: true, force: true });
});
