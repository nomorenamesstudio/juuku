import { useEffect, useRef, useState } from 'react';
import { coverUrl } from './api';
import { formatTime } from './format';
import {
  ChevronDownIcon,
  HeartIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  QueueIcon,
  ShuffleIcon,
  VolumeIcon,
} from './icons';
import { navigate } from './router';
import type { Jukebox } from './useJukebox';

/** Bottom bar: compact mini player on phones, full transport bar on wide screens. */
export function NowBar({ jbox }: { jbox: Jukebox }) {
  const { current, status, entries } = jbox;
  const [volumeDraft, setVolumeDraft] = useState<number | null>(null);
  const volumeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(volumeTimer.current), []);

  if (!current || !status) return null;

  const duration = current.duration || 0;
  const progress = duration ? Math.min(status.position / duration, 1) : 0;
  const gain = volumeDraft ?? status.gain;

  const onVolume = (value: number) => {
    setVolumeDraft(value);
    window.clearTimeout(volumeTimer.current);
    volumeTimer.current = window.setTimeout(() => {
      jbox.setGain(value).then(() => setVolumeDraft(null));
    }, 150);
  };

  return (
    <div className="nowbar">
      <div className="nowbar-progress" aria-hidden>
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="nowbar-left">
        <button className="nowbar-open" onClick={() => navigate('/player')} aria-label="Open the player">
          <span className="nowbar-art">
            {current.coverArt ? <img src={coverUrl(current.coverArt, 160)} alt="" /> : null}
          </span>
          <span className="nowbar-text">
            <span className="nowbar-title">{current.title}</span>
            <span className="nowbar-sub">
              {current.artist}
              <span className="nowbar-time"> · {formatTime(status.position)}</span>
            </span>
          </span>
        </button>
        <button
          className={`icon-button bar-only ${jbox.favoriteIds.has(current.id) ? 'is-fav' : ''}`}
          onClick={() => jbox.toggleFavorite(current)}
          aria-pressed={jbox.favoriteIds.has(current.id)}
          aria-label="Favorite this track"
        >
          <HeartIcon size={18} filled={jbox.favoriteIds.has(current.id)} />
        </button>
      </div>

      <div className="nowbar-center">
        <button className="icon-button bar-only" onClick={jbox.shuffleQueue} disabled={jbox.busy || entries.length < 2} aria-label="Shuffle queue">
          <ShuffleIcon size={18} />
        </button>
        <button className="icon-button bar-only" onClick={() => jbox.step(-1)} disabled={jbox.busy || status.currentIndex <= 0} aria-label="Previous track">
          <PrevIcon size={20} />
        </button>
        <button className="nowbar-play" onClick={jbox.togglePlay} disabled={jbox.busy} aria-label={status.playing ? 'Pause' : 'Play'}>
          {status.playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
        </button>
        <button
          className="icon-button"
          onClick={() => jbox.step(1)}
          disabled={jbox.busy || status.currentIndex >= entries.length - 1}
          aria-label="Next track"
        >
          <NextIcon size={20} />
        </button>
      </div>

      <div className="nowbar-right">
        <label className="nowbar-volume bar-only">
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
        <button className="icon-button" onClick={() => navigate('/queue')} aria-label="Open the queue">
          <QueueIcon size={20} />
        </button>
        <button className="icon-button bar-only" onClick={() => navigate('/player')} aria-label="Expand the player">
          <ChevronDownIcon size={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>
    </div>
  );
}
