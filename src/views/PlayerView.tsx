import { useEffect, useMemo, useRef, useState } from 'react';
import { type Lyrics, coverUrl, getLyrics } from '../api';
import { formatTime } from '../format';
import {
  ChevronDownIcon,
  HeartIcon,
  MicIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  RepeatOneIcon,
  VolumeIcon,
} from '../icons';
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

function useLyrics(songId: string | undefined) {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  useEffect(() => {
    setLyrics(null);
    if (!songId) return;
    let live = true;
    getLyrics(songId).then(
      (payload) => live && setLyrics(payload),
      () => live && setLyrics({ source: 'none', synced: false, lines: [] }),
    );
    return () => {
      live = false;
    };
  }, [songId]);
  return lyrics;
}

function LyricsPane({ lyrics, activeLine }: { lyrics: Lyrics | null; activeLine: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeLine < 0 || !ref.current) return;
    const node = ref.current.querySelector<HTMLElement>(`[data-line="${activeLine}"]`);
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeLine]);

  return (
    <div className="lyrics" ref={ref}>
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
      {lyrics && lyrics.lines.length > 0 && (
        <p className="lyrics-note source">
          {lyrics.synced ? 'synced' : 'unsynced'} · {lyrics.source === 'lrclib' ? 'from LRCLIB' : 'embedded'}
        </p>
      )}
    </div>
  );
}

export function PlayerView({
  jbox,
  lyricsOpen,
  onLyricsOpenChange,
}: {
  jbox: Jukebox;
  lyricsOpen: boolean;
  onLyricsOpenChange: (open: boolean) => void;
}) {
  const { current, status, entries } = jbox;
  const showLyrics = lyricsOpen;
  const setShowLyrics = onLyricsOpenChange;
  const [trackDraft, setTrackDraft] = useState<number | null>(null);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const trackTimer = useRef<number | undefined>(undefined);
  const volumeTimer = useRef<number | undefined>(undefined);
  const lyrics = useLyrics(current?.id);
  const close = () => goBack();
  const { dragY, dragging, handlers } = usePullToDismiss(close);

  const duration = current?.duration ?? 0;
  const position = trackDraft ?? status?.position ?? 0;
  const activeLine = useMemo(() => {
    if (!lyrics?.synced) return -1;
    const ms = position * 1000;
    let index = -1;
    lyrics.lines.forEach((line, lineIndex) => {
      if (line.time !== undefined && line.time <= ms) index = lineIndex;
    });
    return index;
  }, [lyrics, position]);

  useEffect(
    () => () => {
      window.clearTimeout(trackTimer.current);
      window.clearTimeout(volumeTimer.current);
    },
    [],
  );

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

  const onVolume = (value: number) => {
    setVolumeDraft(value);
    window.clearTimeout(volumeTimer.current);
    volumeTimer.current = window.setTimeout(() => {
      jbox.setGain(value).then(() => setVolumeDraft(null));
    }, 150);
  };

  const gain = volumeDraft ?? status?.gain ?? 1;

  return (
    <div
      className={`view player ${showLyrics ? 'lyrics-on' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ transform: `translate3d(0, ${dragY}px, 0)` }}
      {...handlers}
    >
      <div className="player-inner">
      <span className="player-grabber" aria-hidden />
      <header className="player-top">
        <span className="player-context">
          {status?.currentIndex !== undefined ? `track ${status.currentIndex + 1} of ${entries.length}` : 'now playing'}
        </span>
        <button
          className={`icon-button ${jbox.repeat !== 'off' ? 'is-on' : ''}`}
          onClick={jbox.cycleRepeat}
          aria-pressed={jbox.repeat !== 'off'}
          aria-label={`Repeat ${jbox.repeat}`}
        >
          {jbox.repeat === 'one' ? <RepeatOneIcon size={18} /> : <RepeatIcon size={18} />}
        </button>
      </header>

      <div className="player-grid">
        <div className="player-main">
          <div className={`player-stage ${showLyrics ? 'lyrics-on' : ''}`}>
            {showLyrics ? (
              <LyricsPane lyrics={lyrics} activeLine={activeLine} />
            ) : (
              <div className="player-art">
                {current.coverArt ? (
                  <img src={coverUrl(current.coverArt, 800)} alt={`${current.album} cover`} draggable={false} />
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
              aria-label="Toggle lyrics"
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
            <label className="volume-inline">
              <VolumeIcon size={18} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={gain}
                onChange={(event) => onVolume(Number(event.target.value))}
                aria-label="Volume"
                aria-valuetext={`${Math.round(gain * 100)}%`}
                style={{ ['--progress' as string]: `${gain * 100}%` }}
              />
            </label>
          </div>
        </div>

        <aside className="player-aside" aria-label="Lyrics">
          <LyricsPane lyrics={lyrics} activeLine={activeLine} />
        </aside>
      </div>
      </div>
    </div>
  );
}
