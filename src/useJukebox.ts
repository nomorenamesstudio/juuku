import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Favorites,
  type Health,
  type PlaybackStatus,
  type Song,
  type State,
  addFavorite,
  control,
  getFavorites,
  getHealth,
  getState,
  playNext as playNextRequest,
  playNow as playNowRequest,
  removeFavorite,
} from './api';

const POLL_MS = 1000;
const REPEAT_KEY = 'juuku.repeat';

export type RepeatMode = 'off' | 'all' | 'one';

interface Snapshot {
  playing: boolean;
  index: number;
  position: number;
  duration: number;
  lastIndex: number;
}

export interface Jukebox {
  state: State | null;
  status: PlaybackStatus | null;
  entries: Song[];
  current: Song | undefined;
  health: Health | null;
  favorites: Song[];
  favoriteIds: Set<string>;
  error: string | null;
  busy: boolean;
  toast: string | null;
  notify: (message: string) => void;
  addToQueue: (songs: Song[], label?: string) => Promise<void>;
  playNow: (songs: Song[]) => Promise<void>;
  playFrom: (songs: Song[], index: number) => Promise<void>;
  playNext: (songs: Song[]) => Promise<void>;
  repeat: RepeatMode;
  cycleRepeat: () => void;
  playAt: (index: number, offset?: number) => Promise<void>;
  removeAt: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  shuffleQueue: () => Promise<void>;
  togglePlay: () => Promise<void>;
  step: (direction: 1 | -1) => Promise<void>;
  setGain: (gain: number) => Promise<void>;
  seek: (seconds: number) => Promise<void>;
  toggleFavorite: (song: Song) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useJukebox(): Jukebox {
  const [state, setState] = useState<State | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [favorites, setFavorites] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<RepeatMode>(() => {
    const stored = window.localStorage.getItem(REPEAT_KEY);
    return stored === 'all' || stored === 'one' ? stored : 'off';
  });
  const toastTimer = useRef<number | undefined>(undefined);
  const repeatRef = useRef(repeat);
  const lastSnapshot = useRef<Snapshot | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    repeatRef.current = repeat;
    window.localStorage.setItem(REPEAT_KEY, repeat);
  }, [repeat]);

  const cycleRepeat = useCallback(() => {
    setRepeat((current) => (current === 'off' ? 'all' : current === 'all' ? 'one' : 'off'));
  }, []);

  /**
   * Subsonic has no repeat, so the client watches the poll and restarts. When the
   * queue runs out Navidrome leaves the last index but resets position to 0 and
   * stops, which is what separates "finished" from a manual pause (position kept).
   */
  const handleQueueEnd = useCallback(async (next: State, prev: Snapshot) => {
    const mode = repeatRef.current;
    if (mode === 'off') return;

    const stopped = prev.playing && !next.status.playing;
    const finished = stopped && next.status.position <= 1 && prev.position > 2;
    const advanced = prev.playing && next.status.playing && next.status.currentIndex > prev.index;

    try {
      if (mode === 'one' && (finished || (advanced && prev.position >= prev.duration - 5))) {
        const index = finished ? Math.max(next.status.currentIndex, 0) : prev.index;
        await control({ action: 'skip', index, offset: 0 });
        await control({ action: 'start' });
        lastSnapshot.current = null;
      } else if (mode === 'all' && finished && prev.index >= prev.lastIndex) {
        await control({ action: 'skip', index: 0, offset: 0 });
        await control({ action: 'start' });
        lastSnapshot.current = null;
      }
    } catch {
      // a failed loop is not worth an error banner; the next poll shows reality
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await getState();
      const previous = lastSnapshot.current;
      lastSnapshot.current = {
        playing: next.status.playing,
        index: next.status.currentIndex,
        position: next.status.position,
        duration: next.entries[next.status.currentIndex]?.duration ?? 0,
        lastIndex: next.entries.length - 1,
      };
      setState(next);
      setError(null);
      if (previous) void handleQueueEnd(next, previous);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [handleQueueEnd]);

  useEffect(() => {
    getHealth().then(setHealth, (err: Error) => setError(err.message));
    getFavorites().then((payload) => setFavorites(payload.songs), () => {});
    refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(toastTimer.current);
    };
  }, [refresh]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, message?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await action();
        setError(null);
        if (message) notify(message);
        return result;
      } catch (err) {
        setError((err as Error).message);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [notify],
  );

  const afterQueueChange = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const addToQueue = useCallback(
    async (songs: Song[], label?: string) => {
      if (songs.length === 0) return;
      await run(async () => {
        await control({ action: 'add', ids: songs.map((song) => song.id) });
        await afterQueueChange();
      }, label ?? (songs.length === 1 ? `Added ${songs[0].title}` : `Added ${songs.length} tracks`));
    },
    [run, afterQueueChange],
  );

  const playNow = useCallback(
    async (songs: Song[]) => {
      if (songs.length === 0) return;
      await run(async () => {
        await playNowRequest(songs.map((song) => song.id));
        await afterQueueChange();
      }, songs.length === 1 ? `Playing ${songs[0].title}` : `Playing ${songs.length} tracks`);
    },
    [run, afterQueueChange],
  );

  const playFrom = useCallback(
    async (songs: Song[], index: number) => {
      if (songs.length === 0) return;
      await run(async () => {
        await playNowRequest(songs.map((song) => song.id), index);
        await afterQueueChange();
      }, songs.length === 1 ? `Playing ${songs[0].title}` : `Playing ${songs.length} tracks`);
    },
    [run, afterQueueChange],
  );

  const playNext = useCallback(
    async (songs: Song[]) => {
      if (songs.length === 0) return;
      await run(async () => {
        await playNextRequest(songs.map((song) => song.id));
        await afterQueueChange();
      }, songs.length === 1 ? `Playing ${songs[0].title} next` : `Playing ${songs.length} tracks next`);
    },
    [run, afterQueueChange],
  );

  const playAt = useCallback(
    async (index: number, offset?: number) => {
      await run(async () => {
        await control({ action: 'skip', index, offset });
        await afterQueueChange();
      });
    },
    [run, afterQueueChange],
  );

  const removeAt = useCallback(
    async (index: number) => {
      await run(async () => {
        await control({ action: 'remove', index });
        await afterQueueChange();
      });
    },
    [run, afterQueueChange],
  );

  const clearQueue = useCallback(async () => {
    await run(async () => {
      await control({ action: 'clear' });
      await afterQueueChange();
    }, 'Queue cleared');
  }, [run, afterQueueChange]);

  const shuffleQueue = useCallback(async () => {
    await run(async () => {
      await control({ action: 'shuffle' });
      await afterQueueChange();
    }, 'Shuffled');
  }, [run, afterQueueChange]);

  const togglePlay = useCallback(async () => {
    const playing = state?.status.playing;
    await run(async () => {
      await control({ action: playing ? 'stop' : 'start' });
      await afterQueueChange();
    });
  }, [state, run, afterQueueChange]);

  const step = useCallback(
    async (direction: 1 | -1) => {
      if (!state) return;
      const target = state.status.currentIndex + direction;
      if (target < 0 || target >= state.entries.length) return;
      await playAt(target);
    },
    [state, playAt],
  );

  const setGain = useCallback(
    async (gain: number) => {
      const applied = await run(() => control({ action: 'setGain', gain }));
      if (applied) setState((prev) => (prev ? { ...prev, status: { ...prev.status, gain: applied.gain } } : prev));
    },
    [run],
  );

  const seek = useCallback(
    async (seconds: number) => {
      if (!state) return;
      await run(async () => {
        await control({ action: 'skip', index: state.status.currentIndex, offset: Math.round(seconds) });
        await afterQueueChange();
      });
    },
    [state, run, afterQueueChange],
  );

  const toggleFavorite = useCallback(
    async (song: Song) => {
      const isFavorite = favorites.some((entry) => entry.id === song.id);
      await run(async () => {
        const updated: Favorites = isFavorite
          ? await removeFavorite(song.id)
          : await addFavorite([song.id]);
        setFavorites(updated.songs);
      }, isFavorite ? `Removed ${song.title} from favorites` : `Favorited ${song.title}`);
    },
    [favorites, run],
  );

  const status = state?.status ?? null;
  const entries = state?.entries ?? [];
  const current = status && status.currentIndex >= 0 ? entries[status.currentIndex] : undefined;

  return {
    state,
    repeat,
    cycleRepeat,
    status,
    entries,
    current,
    health,
    favorites,
    favoriteIds: new Set(favorites.map((song) => song.id)),
    error,
    busy,
    toast,
    notify,
    addToQueue,
    playNow,
    playFrom,
    playNext,
    playAt,
    removeAt,
    clearQueue,
    shuffleQueue,
    togglePlay,
    step,
    setGain,
    seek,
    toggleFavorite,
    refresh,
  };
}
