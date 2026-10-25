/**
 * Reporting what plays to Navidrome, which is where scrobbling belongs.
 *
 * Navidrome only scrobbles its own player: jukebox playback goes straight to mpv through
 * `jukeboxControl`, so its Last.fm and ListenBrainz agents never hear about it. But its
 * Subsonic `scrobble` endpoint runs the same play tracker, so one call per event is
 * enough — no keys, no secrets, nothing for the user to connect here.
 *
 * The rules are the interesting part, and they are pure state plus one callback.
 */
/** a scrobble only counts from 30 seconds up */
const MIN_DURATION = 30;
/** 50% or four minutes, whichever comes first */
export const thresholdFor = (duration) => Math.min(240, Math.floor(duration / 2));

/**
 * What is playing, how much of it was actually heard, and whether it has been reported.
 * `send` receives `{ type: 'now-playing' | 'scrobble', id, timestamp }`.
 *
 * "Heard" is summed from the position deltas we observe rather than read off the
 * position, so dragging into the last chorus does not count as a play.
 */
export function createScrobbler(send) {
  let current = null; // { id, startedAt, heard, scrobbled, lastPosition }

  function start(entry, position, now) {
    current = { id: entry.id, startedAt: now - position * 1000, heard: 0, scrobbled: false, lastPosition: position };
    void send({ type: 'now-playing', id: entry.id });
  }

  function observe(state, now = Date.now()) {
    const index = state?.status?.currentIndex ?? -1;
    const entry = index >= 0 ? state?.entries?.[index] : null;
    const playing = Boolean(state?.status?.playing);
    const position = Number(state?.status?.position ?? 0);

    if (!entry || !playing) {
      // paused or empty: keep `current`, so resuming the same track does not start over
      if (current) current.lastPosition = position;
      return;
    }

    if (!current || current.id !== entry.id) {
      start(entry, position, now);
      return;
    }

    const delta = position - current.lastPosition;
    // a poll is a second apart; a jump larger than that is a seek and is not "heard"
    if (delta > 0 && delta <= 10) current.heard += delta;
    current.lastPosition = position;

    const duration = Number(entry.duration ?? 0);
    if (!current.scrobbled && duration >= MIN_DURATION && current.heard >= thresholdFor(duration)) {
      current.scrobbled = true;
      // Navidrome parses `time` as milliseconds since the epoch
      void send({ type: 'scrobble', id: entry.id, timestamp: Math.floor(current.startedAt) });
    }
  }

  return { observe };
}
