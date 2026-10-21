import { useEffect, useState } from 'react';
import { type Lyrics, getLyrics } from './api';

/**
 * One lyrics request per track per browser session. The bottom bar needs to know
 * whether a track has lyrics at all — that is what decides whether its lyrics button
 * is usable — and the player wants the same answer a second later, so the two share
 * this instead of asking twice. Misses are kept as well: the server caches them for a
 * day, and "this track has none" is not going to change while the tab is open.
 */
const cache = new Map<string, Lyrics>();

const NONE: Lyrics = { source: 'none', synced: false, lines: [] };

export function useLyrics(songId: string | undefined, lookup: boolean): Lyrics | null {
  const key = songId ? `${songId}:${lookup ? 'lookup' : 'embedded'}` : '';
  const [lyrics, setLyrics] = useState<Lyrics | null>(() => (key ? (cache.get(key) ?? null) : null));

  useEffect(() => {
    if (!songId) {
      setLyrics(null);
      return;
    }
    const hit = cache.get(key);
    if (hit) {
      setLyrics(hit);
      return;
    }
    setLyrics(null);
    let live = true;
    getLyrics(songId, lookup).then(
      (payload) => {
        cache.set(key, payload);
        if (live) setLyrics(payload);
      },
      () => {
        // a failed lookup is not a track without lyrics, but it is not worth an
        // error banner over the player either: show nothing and let the next visit retry
        if (live) setLyrics(NONE);
      },
    );
    return () => {
      live = false;
    };
  }, [songId, lookup, key]);

  return lyrics;
}
