import { useEffect, useState } from 'react';
import { type Artist, getArtists, getCounts } from './api';

export interface Counts {
  albums: number | null;
  artists: Artist[];
}

// the rail and the library tabs both want these, so fetch once per session
let cached: Counts | null = null;
let inflight: Promise<Counts> | null = null;

function load() {
  inflight ??= Promise.all([getCounts(), getArtists()])
    .then(([totals, list]) => {
      cached = { albums: totals.albums, artists: list.artists };
      return cached;
    })
    .catch(() => {
      cached = { albums: null, artists: [] };
      return cached;
    });
  return inflight;
}

export function useCounts(): Counts | null {
  const [counts, setCounts] = useState<Counts | null>(cached);
  useEffect(() => {
    if (cached) return;
    let alive = true;
    void load().then((value) => {
      if (alive) setCounts(value);
    });
    return () => {
      alive = false;
    };
  }, []);
  return counts;
}
