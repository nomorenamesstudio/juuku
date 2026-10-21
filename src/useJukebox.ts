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
  dismissError: () => void;
  busy: boolean;
  toast: string | null;
  notify: (message: string) => void;
  addToQueue: (songs: Song[], label?: string) => Promise<void>;
  playNow: (songs: Song[]) => Promise<void>;
  playFrom: (songs: Song[], index: number) => Promise<void>;
  playNext: (songs: Song[]) => Promise<void>;
  repeat: RepeatMode;
  cycleRepeat: () => void;
  /** the queue ran out with repeat off: nothing is playing, the bar should go */
  ended: boolean;
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

export function useJukebox({ paused = false }: { paused?: boolean } = {}): Jukebox {
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
  const [ended, setEnded] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const repeatRef = useRef(repeat);
  const lastSnapshot = useRef<Snapshot | null>(null);
  // playback has been seen at some point in this session, so a queue found sitting
  // at its end on load is history, not an event to react to
  const armed = useRef(false);
  // this "ended" already had its repeat handled, so the poll does not loop it again
  const endHandled = useRef(false);
  // the number of the newest state read, so a slow one cannot overwrite a fast one
  const readSeq = useRef(0);
  const polling = useRef(false);

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
   * queue runs out Navidrome leaves the last index, drops position to 0 and stops
   * (measured: `playing=false index=last pos=0` for as long as you leave it), which
   * is what separates "finished" from a manual pause — a pause keeps its position.
   *
   * That is a *state*, not an event, and it used to be detected as an event
   * (`previous.playing && !next.playing`): one poll landing after the end set the
   * snapshot to `playing=false`, and the transition was gone for good — repeat
   * worked only when the poll happened to straddle the end.
   */
  const handleQueueEnd = useCallback(async (next: State) => {
    const mode = repeatRef.current;

    // No "stalled switch" nudge any more: it fired while a queue change was still
    // in flight (index moved, not playing yet, position 0) and its extra `start`
    // spawned a second mpv — the same track played twice. The silence it used to
    // patch came from the exclusive sound card, which dmix fixed.

    if (mode === 'off') {
      setEnded(true);
      return;
    }

    /**
     * A skip already resumes playback in Navidrome (it pauses, switches, then starts
     * again). Sending `start` on top of it raced the switch and produced a *second*
     * mpv — two tracks at once — so the follow-up only goes out when playback had
     * stopped and the skip alone would not restart it.
     */
    try {
      const index = mode === 'one' ? Math.max(next.status.currentIndex, 0) : 0;
      await control({ action: 'skip', index, offset: 0 });
      await control({ action: 'start' });
      setEnded(false);
      lastSnapshot.current = null;
    } catch {
      // a failed loop is not worth an error banner; the next poll shows reality
    }
  }, []);

  /** repeat-one on a queue that keeps going: the finished track is replayed */
  const handleRepeatOne = useCallback(async (next: State, prev: Snapshot) => {
    // No "stalled switch" nudge any more: it fired while a queue change was still
    // in flight (index moved, not playing yet, position 0) and its extra `start`
    // spawned a second mpv — the same track played twice. The silence it used to
    // patch came from the exclusive sound card, which dmix fixed.

    if (repeatRef.current !== 'one') return;

    const advanced = prev.playing && next.status.playing && next.status.currentIndex > prev.index;
    if (!advanced || prev.position < prev.duration - 5) return;

    try {
      await control({ action: 'skip', index: prev.index, offset: 0 });
      lastSnapshot.current = null;
    } catch {
      // a failed loop is not worth an error banner; the next poll shows reality
    }
  }, []);

  const refresh = useCallback(async () => {
    const mine = (readSeq.current += 1);
    try {
      const next = await getState();
      // a read that started earlier can answer later: only the newest one may land,
      // or the queue and its position jump back to where they were
      if (mine !== readSeq.current) return;
      const previous = lastSnapshot.current;
      const lastIndex = next.entries.length - 1;
      lastSnapshot.current = {
        playing: next.status.playing,
        index: next.status.currentIndex,
        position: next.status.position,
        duration: next.entries[next.status.currentIndex]?.duration ?? 0,
        lastIndex,
      };
      // deliberately not clearing `error` here: a successful poll used to erase the
      // message from a failed action before anyone could read it
      setState(next);

      if (next.status.playing) {
        armed.current = true;
        endHandled.current = false;
        setEnded(false);
      } else if (next.status.currentIndex !== lastIndex) {
        // left the end by hand (another track, a new queue): re-arm for the next one
        endHandled.current = false;
      }

      const atEnd =
        !next.status.playing &&
        lastIndex >= 0 &&
        next.status.currentIndex === lastIndex &&
        next.status.position <= 0.5;

      if (atEnd && armed.current && !endHandled.current) {
        endHandled.current = true;
        void handleQueueEnd(next);
      } else if (previous) {
        void handleRepeatOne(next, previous);
      }
    } catch (err) {
      if (mine === readSeq.current) setError((err as Error).message);
    }
  }, [handleQueueEnd, handleRepeatOne]);

  useEffect(() => {
    // while the login screen is up there is nothing to poll for, and every call is a 401
    if (paused) return;
    getHealth().then(setHealth, (err: Error) => setError(err.message));
    getFavorites().then((payload) => setFavorites(payload.songs), () => {});
    refresh();
    const timer = window.setInterval(() => {
      // a poll that is still waiting for a stuck server must not be joined by the
      // next tick: ten of them used to stack up behind one hanging request
      if (document.hidden || polling.current) return;
      polling.current = true;
      void refresh().finally(() => {
        polling.current = false;
      });
    }, POLL_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(toastTimer.current);
    };
  }, [refresh, paused]);

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

  // same as run(), without touching `busy`: volume and seeking happen while the
  // user keeps interacting, and busy dims every transport button mid-drag
  const quietly = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      try {
        const result = await action();
        setError(null);
        return result;
      } catch (err) {
        setError((err as Error).message);
        return undefined;
      }
    },
    [],
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
      const applied = await quietly(() => control({ action: 'setGain', gain }));
      if (applied) setState((prev) => (prev ? { ...prev, status: { ...prev.status, gain: applied.gain } } : prev));
    },
    [quietly],
  );

  const seek = useCallback(
    async (seconds: number) => {
      if (!state) return;
      await quietly(async () => {
        await control({ action: 'skip', index: state.status.currentIndex, offset: Math.round(seconds) });
        await afterQueueChange();
      });
    },
    [state, quietly, afterQueueChange],
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
    ended,
    status,
    entries,
    current,
    health,
    favorites,
    favoriteIds: new Set(favorites.map((song) => song.id)),
    error,
    dismissError: () => setError(null),
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
