import { useEffect, useState } from 'react';
import { type Artist, getArtists, getCounts } from './api';

export interface Counts {
  albums: number | null;
  playlists: number | null;
  artists: Artist[];
}

// the rail and the library tabs both want these, so fetch once per session
let cached: Counts | null = null;
let inflight: Promise<Counts> | null = null;

function load() {
  inflight ??= Promise.all([getCounts(), getArtists()])
    .then(([totals, list]) => {
      cached = { albums: totals.albums, playlists: totals.playlists, artists: list.artists };
      return cached;
    })
    .catch(() => {
      // keep the empty answer for this render, but do not cache it: one transient
      // failure used to leave the pills and the Artists tab empty for the session
      cached = null;
      inflight = null;
      return { albums: null, playlists: null, artists: [] };
    });
  return inflight;
}

export function useCounts({ paused = false }: { paused?: boolean } = {}): Counts | null {
  const [counts, setCounts] = useState<Counts | null>(cached);
  useEffect(() => {
    if (cached || paused) return;
    let alive = true;
    void load().then((value) => {
      if (alive) setCounts(value);
    });
    return () => {
      alive = false;
    };
  }, [paused]);
  return counts;
}
