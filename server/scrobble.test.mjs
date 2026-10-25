import assert from 'node:assert/strict';
import test from 'node:test';
import { createScrobbler, thresholdFor } from './scrobble.mjs';

// Navidrome's own scrobbler never sees jukebox playback, so these rules are the only
// thing standing between "it played" and a wrong scrobble: what counts as played, when
// it is reported, and that a skip is not a play.

test('the threshold is half the track, four minutes at most', () => {
  assert.equal(thresholdFor(180), 90);
  assert.equal(thresholdFor(600), 240, 'a long track still reports after four minutes');
  assert.equal(thresholdFor(31), 15);
});

/** drive the state machine a second at a time, the way the poll does */
function play(scrobbler, { id = 'song-1', duration = 200, from = 0, seconds = 0, t0 = 1_700_000_000_000 }) {
  let now = t0;
  let position = from;
  for (let i = 0; i < seconds; i += 1) {
    scrobbler.observe({ status: { currentIndex: 0, playing: true, position }, entries: [{ id, duration }] }, now);
    now += 1000;
    position += 1;
  }
  return { now, position };
}

const collect = () => {
  const events = [];
  return { events, send: (event) => events.push(event) };
};

test('a track reports now-playing once, then a scrobble past the threshold', () => {
  const { events, send } = collect();
  const scrobbler = createScrobbler(send);

  play(scrobbler, { seconds: 5 });
  assert.deepEqual(events.map((e) => e.type), ['now-playing']);
  assert.equal(events[0].id, 'song-1', 'the media file id Navidrome scrobbles');

  play(scrobbler, { seconds: 100 }); // 105 heard, threshold for 200s is 100
  assert.deepEqual(events.map((e) => e.type), ['now-playing', 'scrobble']);
  assert.equal(events[1].timestamp, 1_700_000_000_000, 'milliseconds, at the start of the track');

  play(scrobbler, { seconds: 60 });
  assert.equal(events.filter((e) => e.type === 'scrobble').length, 1, 'one scrobble per play, never two');
});

test('a skip before the threshold reports nothing', () => {
  const { events, send } = collect();
  const scrobbler = createScrobbler(send);
  play(scrobbler, { seconds: 20 });
  play(scrobbler, { id: 'song-2', seconds: 5 });
  assert.deepEqual(events.map((e) => e.type), ['now-playing', 'now-playing'], 'no scrobble for the skipped track');
});

test('jumping into a track is not the same as hearing it', () => {
  const { events, send } = collect();
  const scrobbler = createScrobbler(send);
  const t0 = 1_700_000_000_000;
  const state = (position) => ({ status: { currentIndex: 0, playing: true, position }, entries: [{ id: 'song-1', duration: 200 }] });

  scrobbler.observe(state(0), t0);
  scrobbler.observe(state(120), t0 + 1000); // dragged to the last chorus
  scrobbler.observe(state(121), t0 + 2000);
  assert.equal(events.filter((e) => e.type === 'scrobble').length, 0, 'a seek is not listening');

  play(scrobbler, { from: 122, seconds: 100, t0: t0 + 3000 });
  assert.equal(events.filter((e) => e.type === 'scrobble').length, 1, 'real seconds still accumulate after a seek');
});

test('a very short track is never scrobbled, and pausing does not restart it', () => {
  const { events, send } = collect();
  const scrobbler = createScrobbler(send);
  const t0 = 1_700_000_000_000;
  const entry = { id: 'short', duration: 20 };
  const state = (position, playing) => ({ status: { currentIndex: 0, playing, position }, entries: [entry] });

  scrobbler.observe(state(0, true), t0);
  for (let i = 1; i <= 25; i += 1) scrobbler.observe(state(i, true), t0 + i * 1000);
  assert.deepEqual(events.map((e) => e.type), ['now-playing'], 'under 30 seconds is never scrobbled');

  scrobbler.observe(state(25, false), t0 + 26_000);
  scrobbler.observe(state(25, true), t0 + 27_000);
  assert.deepEqual(events.map((e) => e.type), ['now-playing'], 'pausing does not restart the play either');
});
