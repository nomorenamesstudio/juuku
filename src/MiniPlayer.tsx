import { useEffect, useRef, useState } from 'react';
import { coverUrl } from './api';
import { formatTime } from './format';
import {
  AddToPlaylistIcon,
  HeartIcon,
  MicIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  QueueIcon,
  VolumeIcon,
} from './icons';
import { goBack, navigate } from './router';
import { useTrackActions } from './TrackActions';
import type { Jukebox } from './useJukebox';

/** Bottom bar: compact mini player on phones, full transport bar on wide screens. */
export function NowBar({ jbox, onOpen, expanded }: { jbox: Jukebox; onOpen?: () => void; expanded?: boolean }) {
  const { current, status, entries } = jbox;
  const openActions = useTrackActions();
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const [positionDraft, setPositionDraft] = useState<number | null>(null);
  const volumeTimer = useRef<number | undefined>(undefined);
  const positionTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(volumeTimer.current);
      window.clearTimeout(positionTimer.current);
    },
    [],
  );

  if (!current || !status) return null;

  const duration = current.duration || 0;
  const position = positionDraft ?? status.position;
  const progress = duration ? Math.min(position / duration, 1) : 0;
  const gain = volumeDraft ?? status.gain;

  const onScrub = (value: number) => {
    setPositionDraft(value);
    window.clearTimeout(positionTimer.current);
    positionTimer.current = window.setTimeout(() => {
      jbox.seek(value).then(() => setPositionDraft(null));
    }, 180);
  };

  const onVolume = (value: number) => {
    setVolumeDraft(value);
    window.clearTimeout(volumeTimer.current);
    volumeTimer.current = window.setTimeout(() => {
      jbox.setGain(value).then(() => setVolumeDraft(null));
    }, 150);
  };

  return (
    <div className="nowbar" role="region" aria-label="Now playing">
      <div className="nowbar-row">

      <div className="nowbar-left">
        <button className="nowbar-open" onClick={onOpen ?? (() => navigate('/player'))} aria-label="Open the player">
          <span className="nowbar-art">
            {current.coverArt ? <img src={coverUrl(current.coverArt, 160)} alt="" /> : null}
          </span>
          <span className="nowbar-text">
            <span className="nowbar-title">{current.title}</span>
            <span className="nowbar-sub">
              {current.artist}
              <span className="nowbar-time"> · {formatTime(position)}</span>
            </span>
          </span>
        </button>
      </div>

      <div className="nowbar-center">
        <button className="icon-button bar-only" onClick={() => jbox.step(-1)} disabled={jbox.busy || status.currentIndex <= 0} aria-label="Previous track">
          <PrevIcon size={18} />
        </button>
        <button className="nowbar-play" onClick={jbox.togglePlay} disabled={jbox.busy} aria-label={status.playing ? 'Pause' : 'Play'}>
          {status.playing ? <PauseIcon size={20} filled /> : <PlayIcon size={20} filled />}
        </button>
        <button
          className="icon-button"
          onClick={() => jbox.step(1)}
          disabled={jbox.busy || status.currentIndex >= entries.length - 1}
          aria-label="Next track"
        >
          <NextIcon size={18} />
        </button>
      </div>

      <div className="nowbar-right">
        <button
          className={`icon-button bar-only ${jbox.favoriteIds.has(current.id) ? 'is-fav' : ''}`}
          onClick={() => jbox.toggleFavorite(current)}
          aria-pressed={jbox.favoriteIds.has(current.id)}
          aria-label="Favorite this track"
        >
          <HeartIcon size={18} filled={jbox.favoriteIds.has(current.id)} />
        </button>
        <button
          className="icon-button bar-only"
          onClick={() => current && openActions([current], { step: 'playlists' })}
          aria-label="Add this track to a playlist"
        >
          <AddToPlaylistIcon size={18} />
        </button>
        <label className="nowbar-volume bar-only">
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
        <button className="icon-button bar-only" onClick={() => navigate('/queue')} aria-label="Open the queue">
          <QueueIcon size={18} />
        </button>
        <button
          className="icon-button bar-only"
          onClick={() => (expanded ? goBack() : navigate('/player'))}
          aria-label={expanded ? 'Close the lyrics view' : 'Open the lyrics view'}
        >
          {/* on wide screens the player is essentially the lyrics view */}
          <MicIcon size={18} />
        </button>
        </div>
      </div>

      <input
        className="nowbar-scrub"
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={1}
        value={Math.min(position, duration || 1)}
        onChange={(event) => onScrub(Number(event.target.value))}
        aria-label="Playback position"
        aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
        style={{ ['--progress' as string]: `${progress * 100}%` }}
      />
    </div>
  );
}
