import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Album,
  type Health,
  type Song,
  type State,
  control,
  coverUrl,
  getAlbumSongs,
  getAlbums,
  getHealth,
  getState,
  search,
} from './api';

const POLL_MS = 1000;

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [gainDraft, setGainDraft] = useState<number | null>(null);
  const gainTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      setState(await getState());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    getHealth().then(setHealth, (err: Error) => setError(err.message));
    getAlbums().then(({ albums }) => setAlbums(albums), () => {});
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      search(q).then(({ songs }) => setResults(songs), (err: Error) => setError(err.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const run = useCallback(
    async (body: Parameters<typeof control>[0]) => {
      setPending(true);
      try {
        await control(body);
        await refresh();
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPending(false);
      }
    },
    [refresh],
  );

  // Volume is a drag target, so the polled value must not fight the thumb:
  // while a draft exists it is what the slider shows, and the send is debounced.
  const commitGain = useCallback(async (gain: number) => {
    try {
      const applied = await control({ action: 'setGain', gain });
      setState((prev) => (prev ? { ...prev, status: { ...prev.status, gain: applied.gain } } : prev));
      setGainDraft(null);
    } catch (err) {
      setError((err as Error).message);
      setGainDraft(null);
    }
  }, []);

  const onGainInput = useCallback(
    (gain: number) => {
      setGainDraft(gain);
      window.clearTimeout(gainTimer.current);
      gainTimer.current = window.setTimeout(() => commitGain(gain), 150);
    },
    [commitGain],
  );

  useEffect(() => () => window.clearTimeout(gainTimer.current), []);

  const entries = state?.entries ?? [];
  const status = state?.status;
  const current = status && status.currentIndex >= 0 ? entries[status.currentIndex] : undefined;
  const duration = current?.duration ?? 0;
  const progress = duration > 0 && status ? Math.min(status.position / duration, 1) : 0;

  const addAlbum = async (album: Album) => {
    try {
      const { songs } = await getAlbumSongs(album.id);
      await run({ action: 'add', ids: songs.map((s) => s.id) });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const totalTime = useMemo(
    () => entries.reduce((sum, entry) => sum + (entry.duration || 0), 0),
    [entries],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          juicebox<span className="dot" /> <span className="muted">navidrome remote</span>
        </div>
        <div className="conn">
          <span className={`led ${error ? 'bad' : health?.ok ? 'good' : 'idle'}`} />
          <span className="muted">{error ?? (health ? `${health.url.replace(/^https?:\/\//, '')} · v${health.navidrome}` : 'connecting…')}</span>
          <button className="ghost" onClick={refresh} title="Refresh now">↻</button>
        </div>
      </header>

      <main>
        <section className="now panel">
          <div className="art">
            {current?.coverArt ? (
              <img src={coverUrl(current.coverArt, 400)} alt={`${current.album} cover`} />
            ) : (
              <div className="art-empty">no track</div>
            )}
          </div>

          <div className="now-body">
            <p className="eyebrow">{status?.playing ? 'now playing' : 'paused'}</p>
            <h1>{current?.title ?? 'Queue is empty'}</h1>
            <p className="meta">
              {current ? `${current.artist} — ${current.album}` : 'Add something from the library below'}
            </p>

            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={status?.position ?? 0}
              aria-label="Playback position"
            >
              <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="times">
              <span>{formatTime(status?.position ?? 0)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            <div className="transport">
              <button
                className="icon"
                aria-label="Shuffle queue"
                disabled={pending || entries.length < 2}
                onClick={() => run({ action: 'shuffle' })}
              >
                <ShuffleIcon />
              </button>
              <button
                className="icon"
                aria-label="Previous track"
                disabled={pending || !status || status.currentIndex <= 0}
                onClick={() => status && run({ action: 'skip', index: status.currentIndex - 1 })}
              >
                <PrevIcon />
              </button>
              <button
                className="play"
                aria-label={status?.playing ? 'Pause' : 'Play'}
                disabled={pending || entries.length === 0}
                onClick={() => run({ action: status?.playing ? 'stop' : 'start' })}
              >
                {status?.playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button
                className="icon"
                aria-label="Next track"
                disabled={pending || !status || status.currentIndex >= entries.length - 1}
                onClick={() => status && run({ action: 'skip', index: status.currentIndex + 1 })}
              >
                <NextIcon />
              </button>
              <button
                className="icon"
                aria-label="Clear queue"
                disabled={pending || entries.length === 0}
                onClick={() => run({ action: 'clear' })}
              >
                <TrashIcon />
              </button>

              <label className="volume">
                <VolumeIcon />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={gainDraft ?? status?.gain ?? 1}
                  aria-label="Volume"
                  aria-valuetext={`${Math.round((gainDraft ?? status?.gain ?? 1) * 100)}%`}
                  onChange={(event) => onGainInput(Number(event.target.value))}
                />
              </label>
            </div>
          </div>
        </section>

        <div className="columns">
          <section className="panel queue">
            <div className="panel-head">
              <h2>Queue</h2>
              <span className="muted">{entries.length} tracks · {formatTime(totalTime)}</span>
            </div>
            {entries.length === 0 ? (
              <p className="empty">Nothing queued yet.</p>
            ) : (
              <ol className="queue-list">
                {entries.map((entry, index) => (
                  <li key={`${entry.id}-${index}`} className={index === status?.currentIndex ? 'active' : ''}>
                    <button
                      className="row"
                      onClick={() => run({ action: 'skip', index })}
                      aria-label={`Play ${entry.title}`}
                      aria-current={index === status?.currentIndex ? 'true' : undefined}
                    >
                      <span className="num">{index === status?.currentIndex ? <EqIcon playing={!!status?.playing} /> : index + 1}</span>
                      <span className="row-text">
                        <span className="row-title">{entry.title}</span>
                        <span className="row-sub">{entry.artist}</span>
                      </span>
                      <span className="row-time">{formatTime(entry.duration)}</span>
                    </button>
                    <button
                      className="remove"
                      aria-label={`Remove ${entry.title} from queue`}
                      disabled={pending}
                      onClick={() => run({ action: 'remove', index })}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel library">
            <div className="panel-head">
              <h2>Library</h2>
              <span className="muted">{query ? `${results.length} matches` : 'newest albums'}</span>
            </div>

            <input
              className="search"
              placeholder="Song, artist, album…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search library"
            />
            <ul className="result-list">
              {query
                ? results.map((songItem) => (
                    <li key={songItem.id}>
                      <button className="row" onClick={() => run({ action: 'add', ids: [songItem.id] })} disabled={pending}>
                        <span className="row-text">
                          <span className="row-title">{songItem.title}</span>
                          <span className="row-sub">{songItem.artist} — {songItem.album}</span>
                        </span>
                        <span className="row-time">{formatTime(songItem.duration)}</span>
                        <span className="plus" aria-hidden>+</span>
                      </button>
                    </li>
                  ))
                : albums.map((album) => (
                    <li key={album.id}>
                      <button className="row" onClick={() => addAlbum(album)} disabled={pending}>
                        {album.coverArt && <img className="thumb" src={coverUrl(album.coverArt, 80)} alt="" />}
                        <span className="row-text">
                          <span className="row-title">{album.name}</span>
                          <span className="row-sub">{album.artist}{album.year ? ` · ${album.year}` : ''} · {album.songCount} tracks</span>
                        </span>
                        <span className="plus" aria-hidden>+</span>
                      </button>
                    </li>
                  ))}
              {query && results.length === 0 && <li className="empty">No matches for “{query}”.</li>}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

const iconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true as const };

const PlayIcon = () => <svg {...iconProps}><path d="M8 5.5v13l11-6.5z" /></svg>;
const PauseIcon = () => <svg {...iconProps}><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>;
const NextIcon = () => <svg {...iconProps}><path d="M6 5.5v13l9-6.5zM17 5h2v14h-2z" /></svg>;
const PrevIcon = () => <svg {...iconProps}><path d="M18 5.5v13l-9-6.5zM5 5h2v14H5z" /></svg>;
const ShuffleIcon = () => <svg {...iconProps}><path d="M16 3l4 4-4 4V9h-2.2l-2 2-1.4-1.4L13 7H16V3zm0 10l4 4-4 4v-4h-3l-3.6-3.6 1.4-1.4L13 14h3v-1zM4 7h4l2.2 2.2-1.4 1.4L7 9H4V7zm0 8h3l7-7 1.4 1.4-7 7H4v-1.4z" /></svg>;
const TrashIcon = () => <svg {...iconProps}><path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z" /></svg>;
const VolumeIcon = () => <svg {...iconProps} width={16} height={16}><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z" /></svg>;
const EqIcon = ({ playing }: { playing: boolean }) => (
  <span className={`eq ${playing ? 'on' : ''}`} aria-hidden>
    <i /><i /><i />
  </span>
);
