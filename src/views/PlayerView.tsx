import { useEffect, useRef, useState } from 'react';
import { type Lyrics, type PlaybackStatus, coverUrl, getLyrics } from '../api';
import { Cover } from '../Cover';
import { formatTime } from '../format';
import {
  AddToPlaylistIcon,
  ChevronDownIcon,
  HeartIcon,
  MicIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  VolumeIcon,
} from '../icons';
import { useTrackActions } from '../TrackActions';
import { goBack, navigate } from '../router';
import type { Jukebox } from '../useJukebox';

/**
 * Pull the sheet down to close it. Only the mobile sheet is draggable: the layout
 * has no scroll on the stage/header, so `touch-action: none` there gives us the
 * whole pointer stream while the lyrics pane keeps scrolling normally.
 */
function usePullToDismiss(onDismiss: () => void) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const origin = useRef<{ y: number; time: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && event.isPrimary === false) return;
    const target = event.target as HTMLElement;
    if (target.closest('input, button, a, [role="slider"], .lyrics')) return;
    origin.current = { y: event.clientY, time: performance.now() };
    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // pointer capture is an optimisation, not a requirement for the drag
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!origin.current) return;
    setDragY(Math.max(0, event.clientY - origin.current.y));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!origin.current) return;
    const travel = Math.max(0, event.clientY - origin.current.y);
    const elapsed = Math.max(1, performance.now() - origin.current.time);
    const velocity = travel / elapsed;
    origin.current = null;
    setDragging(false);
    if (travel > 110 || (velocity > 0.6 && travel > 40)) {
      setDragY(window.innerHeight);
      window.setTimeout(onDismiss, 190);
      return;
    }
    setDragY(0);
  };

  return {
    dragY,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  };
}

function useLyrics(songId: string | undefined, lookup: boolean) {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  useEffect(() => {
    setLyrics(null);
    if (!songId) return;
    let live = true;
    getLyrics(songId, lookup).then(
      (payload) => live && setLyrics(payload),
      () => live && setLyrics({ source: 'none', synced: false, lines: [] }),
    );
    return () => {
      live = false;
    };
  }, [songId, lookup]);
  return lyrics;
}

/**
 * The volume slider keeps its own draft. Holding it in the player re-rendered the
 * transport on every pointer move, which made the buttons repaint mid-drag.
 */
function VolumeRow({ gain, onCommit }: { gain: number; onCommit: (gain: number) => void }) {
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef(0);
  const value = draft ?? gain;

  useEffect(() => {
    // the server caught up: stop overriding it
    if (draft !== null && Math.abs(draft - gain) < 0.005) setDraft(null);
  }, [draft, gain]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const change = (next: number) => {
    setDraft(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onCommit(next), 150);
  };

  const flush = () => {
    if (draft === null) return;
    window.clearTimeout(timer.current);
    onCommit(draft);
  };

  return (
    <label className="volume-inline">
      <VolumeIcon size={18} />
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => change(Number(event.target.value))}
        onPointerUp={flush}
        onKeyUp={flush}
        onBlur={flush}
        aria-label="Volume"
        aria-valuetext={`${Math.round(value * 100)}%`}
        style={{ ['--progress' as string]: `${value * 100}%` }}
      />
    </label>
  );
}

/**
 * The position arrives once a second, so a highlight timed off it trails the audio
 * by up to a second. Extrapolate from the last poll while playing and tick a few
 * times a second — inside this component, so only the words re-render.
 */
function useActiveLine(lyrics: Lyrics | null, status: PlaybackStatus | null | undefined, leadMs: number) {
  const anchor = useRef({ position: 0, at: 0, playing: false });
  const [, setTick] = useState(0);

  useEffect(() => {
    anchor.current = { position: status?.position ?? 0, at: performance.now(), playing: Boolean(status?.playing) };
    setTick((n) => n + 1);
  }, [status?.position, status?.playing]);

  useEffect(() => {
    if (!status?.playing || !lyrics?.synced) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [status?.playing, lyrics?.synced]);

  if (!lyrics?.synced) return -1;
  const { position, at, playing } = anchor.current;
  const seconds = position + (playing ? (performance.now() - at) / 1000 : 0);
  // the row highlights a touch early, which reads better than a beat late
  const ms = seconds * 1000 + leadMs;
  let index = -1;
  lyrics.lines.forEach((line, lineIndex) => {
    if (line.time !== undefined && line.time <= ms) index = lineIndex;
  });
  return index;
}

/** the lyrics column with its own clock, so ticks do not re-render the player */
function SyncedLyrics({
  lyrics,
  status,
  leadMs,
}: {
  lyrics: Lyrics | null;
  status: PlaybackStatus | null | undefined;
  leadMs: number;
}) {
  const activeLine = useActiveLine(lyrics, status, leadMs);
  return <LyricsPane lyrics={lyrics} activeLine={activeLine} />;
}

function LyricsPane({ lyrics, activeLine }: { lyrics: Lyrics | null; activeLine: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLine < 0 || !ref.current) return;
    const node = ref.current.querySelector<HTMLElement>(`[data-line="${activeLine}"]`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeLine]);

  return (
    <div
      className="lyrics"
      ref={ref}
      tabIndex={0}
      role="region"
      aria-label="Lyrics"
    >
      {lyrics && lyrics.lines.length > 0 && (
        <p className="lyrics-note source">
          {lyrics.synced ? 'synced' : 'unsynced'} · {lyrics.source === 'lrclib' ? 'from LRCLIB' : 'embedded'}
        </p>
      )}
      {lyrics === null && <p className="lyrics-note">Reading…</p>}
      {lyrics && lyrics.lines.length === 0 && (
        <p className="lyrics-note">
          No lyrics for this track. Navidrome had none embedded and LRCLIB has no match — add a `.lrc` next to the file
          or embed lyrics in the tags.
        </p>
      )}
      {lyrics?.lines.map((line, index) => (
        <p
          key={`${index}-${line.time ?? 'x'}`}
          data-line={index}
          className={`lyric ${lyrics.synced ? 'timed' : ''} ${index === activeLine ? 'on' : ''}`}
        >
          {line.text || '\u00a0'}
        </p>
      ))}
    </div>
  );
}

export function PlayerView({
  jbox,
  lyricsOpen,
  lyricLeadMs,
  lyricsLookup,
  onLyricsOpenChange,
}: {
  jbox: Jukebox;
  lyricsOpen: boolean;
  lyricLeadMs: number;
  lyricsLookup: boolean;
  onLyricsOpenChange: (open: boolean) => void;
}) {
  const { current, status, entries } = jbox;
  const showLyrics = lyricsOpen;
  const setShowLyrics = onLyricsOpenChange;
  const [trackDraft, setTrackDraft] = useState<number | null>(null);
  const trackTimer = useRef<number | undefined>(undefined);
  const lyrics = useLyrics(current?.id, lyricsLookup);
  // known-empty means no `.lrc`, no tag and no LRCLIB match; while it loads we do
  // not know yet, and inside lyrics mode the toggle stays usable so you can leave
  const lyricsMissing = lyrics !== null && lyrics.lines.length === 0;
  const openActions = useTrackActions();
  const close = () => goBack();
  const { dragY, dragging, handlers } = usePullToDismiss(close);

  const duration = current?.duration ?? 0;
  const position = trackDraft ?? status?.position ?? 0;
  useEffect(() => () => window.clearTimeout(trackTimer.current), []);

  if (!current) {
    return (
      <div className={`view player ${showLyrics ? 'lyrics-on' : ''}`}>
        <button className="back" onClick={() => goBack()}>
          <ChevronDownIcon size={18} /> Back
        </button>
        <p className="empty">Nothing playing. The queue is empty.</p>
      </div>
    );
  }

  const onScrub = (value: number) => {
    setTrackDraft(value);
    window.clearTimeout(trackTimer.current);
    trackTimer.current = window.setTimeout(() => {
      jbox.seek(value).then(() => setTrackDraft(null));
    }, 200);
  };

  const glow = current.coverArt ? coverUrl(current.coverArt, 300) : null;

  return (
    <div
      className={`view player ${showLyrics ? 'lyrics-on' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ transform: `translate3d(0, ${dragY}px, 0)` }}
      {...handlers}
    >
      {/* the same cover glow the album page has, following the current track */}
      {glow ? (
        <div className="album-backdrop player-glow" style={{ ['--cover-url' as string]: `url(${glow})` }} aria-hidden="true" />
      ) : null}
      <div className="player-inner">
      <span className="player-grabber" aria-hidden />
      <header className="player-top">
        <button className="icon-button" onClick={close} aria-label="Close the player">
          <ChevronDownIcon size={18} />
        </button>
        <span className="player-context">
          {status?.currentIndex !== undefined ? `track ${status.currentIndex + 1} of ${entries.length}` : 'now playing'}
        </span>
        <div className="player-top-actions">
          <button
            className="icon-button"
            onClick={() => openActions([current], { step: 'playlists' })}
            aria-label="Add this track to a playlist"
          >
            <AddToPlaylistIcon size={18} />
          </button>
        </div>
      </header>

      <div className="player-grid">
        <div className="player-main">
          <div className={`player-stage ${showLyrics ? 'lyrics-on' : ''}`}>
            {showLyrics ? (
              <>
                {/* lyrics mode has no visible track title, so the page still needs one */}
                <h1 className="sr-only">{current.title} — lyrics</h1>
                <SyncedLyrics lyrics={lyrics} status={status} leadMs={lyricLeadMs} />
              </>
            ) : (
              <div className="player-art">
                {current.coverArt ? (
                  <Cover src={coverUrl(current.coverArt, 800)} alt={`${current.album} cover`} draggable={false} />
                ) : null}
              </div>
            )}
          </div>

          <div className="player-meta">
            <h1 className="display track-title">{current.title}</h1>
            <p className="byline">
              {current.artistId ? (
                <button className="artist-link" onClick={() => navigate(`/artist/${current.artistId}`)}>
                  {current.artist}
                </button>
              ) : (
                current.artist
              )}{' '}
              <span className="sep">·</span>{' '}
              {current.albumId ? (
                <button className="artist-link" onClick={() => navigate(`/album/${current.albumId}`)}>
                  {current.album}
                </button>
              ) : (
                current.album
              )}
              {current.year ? <span className="year"> · {current.year}</span> : null}
            </p>
          </div>

          <div className="scrub">
            <input
              type="range"
              min={0}
              max={Math.max(duration, 1)}
              step={1}
              value={Math.min(position, duration || 1)}
              onChange={(event) => onScrub(Number(event.target.value))}
              aria-label="Playback position"
              aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
              style={{ ['--progress' as string]: `${duration ? (position / duration) * 100 : 0}%` }}
            />
            <div className="scrub-times">
              <span>{formatTime(position)}</span>
              <span>−{formatTime(Math.max(duration - position, 0))}</span>
            </div>
          </div>

          <div className="transport">
            <button
              className={`icon-button lyrics-toggle ${showLyrics ? 'is-on' : ''}`}
              onClick={() => setShowLyrics(!showLyrics)}
              aria-pressed={showLyrics}
              aria-label="Show lyrics"
              disabled={lyricsMissing && !showLyrics}
            >
              <MicIcon size={18} />
            </button>
            <button
              className="icon-button"
              onClick={() => jbox.step(-1)}
              disabled={jbox.busy || !status || status.currentIndex <= 0}
              aria-label="Previous track"
            >
              <PrevIcon size={22} />
            </button>
            <button
              className="play-button"
              onClick={jbox.togglePlay}
              disabled={jbox.busy}
              aria-label={status?.playing ? 'Pause' : 'Play'}
            >
              {status?.playing ? <PauseIcon size={26} filled /> : <PlayIcon size={26} filled />}
            </button>
            <button
              className="icon-button"
              onClick={() => jbox.step(1)}
              disabled={jbox.busy || !status || status.currentIndex >= entries.length - 1}
              aria-label="Next track"
            >
              <NextIcon size={22} />
            </button>
            <button
              className={`icon-button fav ${jbox.favoriteIds.has(current.id) ? 'is-fav' : ''}`}
              onClick={() => jbox.toggleFavorite(current)}
              aria-pressed={jbox.favoriteIds.has(current.id)}
              aria-label="Favorite this track"
            >
              <HeartIcon size={18} filled={jbox.favoriteIds.has(current.id)} />
            </button>
          </div>

          <div className="player-bottom">
            <VolumeRow gain={status?.gain ?? 1} onCommit={(value) => void jbox.setGain(value)} />
          </div>

        </div>

        <aside className="player-aside" aria-label="Lyrics">
          <SyncedLyrics lyrics={lyrics} status={status} leadMs={lyricLeadMs} />
        </aside>
      </div>
      </div>
    </div>
  );
}
