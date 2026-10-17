import { useEffect, useMemo, useRef, useState } from 'react';
import { type Lyrics, coverUrl, getLyrics } from '../api';
import { formatTime } from '../format';
import {
  ChevronDownIcon,
  HeartIcon,
  LyricsIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  ShuffleIcon,
  VolumeIcon,
} from '../icons';
import type { Jukebox } from '../useJukebox';

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

export function PlayerView({ jbox }: { jbox: Jukebox }) {
  const { current, status, entries } = jbox;
  const [showLyrics, setShowLyrics] = useState(false);
  const [trackDraft, setTrackDraft] = useState<number | null>(null);
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const trackTimer = useRef<number | undefined>(undefined);
  const volumeTimer = useRef<number | undefined>(undefined);
  const lyrics = useLyrics(current?.id);

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
      <div className="view player">
        <button className="back" onClick={() => window.history.back()}>
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
    <div className="view player">
      <header className="player-top">
        <button className="icon-button" onClick={() => window.history.back()} aria-label="Minimize player">
          <ChevronDownIcon size={22} />
        </button>
        <span className="player-context">
          {status?.currentIndex !== undefined ? `track ${status.currentIndex + 1} of ${entries.length}` : 'now playing'}
        </span>
        <button
          className={`icon-button fav ${jbox.favoriteIds.has(current.id) ? 'is-fav' : ''}`}
          onClick={() => jbox.toggleFavorite(current)}
          aria-pressed={jbox.favoriteIds.has(current.id)}
          aria-label="Favorite this track"
        >
          <HeartIcon size={20} filled={jbox.favoriteIds.has(current.id)} />
        </button>
      </header>

      <div className="player-grid">
        <div className="player-main">
          <div className={`player-stage ${showLyrics ? 'lyrics-on' : ''}`}>
            {showLyrics ? (
              <LyricsPane lyrics={lyrics} activeLine={activeLine} />
            ) : (
              <div className="player-art">
                {current.coverArt ? <img src={coverUrl(current.coverArt, 800)} alt={`${current.album} cover`} /> : null}
              </div>
            )}
          </div>

          <div className="player-meta">
            <h1 className="display track-title">{current.title}</h1>
            <p className="byline">
              {current.artist} <span className="sep">·</span> {current.album}
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
              className="icon-button"
              onClick={jbox.shuffleQueue}
              disabled={jbox.busy || entries.length < 2}
              aria-label="Shuffle queue"
            >
              <ShuffleIcon size={20} />
            </button>
            <button
              className="icon-button"
              onClick={() => jbox.step(-1)}
              disabled={jbox.busy || !status || status.currentIndex <= 0}
              aria-label="Previous track"
            >
              <PrevIcon size={26} />
            </button>
            <button
              className="play-button"
              onClick={jbox.togglePlay}
              disabled={jbox.busy}
              aria-label={status?.playing ? 'Pause' : 'Play'}
            >
              {status?.playing ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
            </button>
            <button
              className="icon-button"
              onClick={() => jbox.step(1)}
              disabled={jbox.busy || !status || status.currentIndex >= entries.length - 1}
              aria-label="Next track"
            >
              <NextIcon size={26} />
            </button>
            <button
              className={`icon-button lyrics-toggle ${showLyrics ? 'is-on' : ''}`}
              onClick={() => setShowLyrics((value) => !value)}
              aria-pressed={showLyrics}
              aria-label="Toggle lyrics"
            >
              <LyricsIcon size={20} />
            </button>
          </div>

          <div className="player-bottom">
            <label className="volume-inline">
              <VolumeIcon size={16} />
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
  );
}
