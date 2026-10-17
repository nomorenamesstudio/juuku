import { coverUrl } from './api';
import { formatTime } from './format';
import { NextIcon, PauseIcon, PlayIcon, QueueIcon } from './icons';
import { navigate } from './router';
import type { Jukebox } from './useJukebox';

export function MiniPlayer({ jbox }: { jbox: Jukebox }) {
  const { current, status, entries } = jbox;
  if (!current || !status) return null;

  const duration = current.duration || 0;
  const progress = duration ? Math.min(status.position / duration, 1) : 0;

  return (
    <div className="mini">
      <div className="mini-progress" aria-hidden>
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <button className="mini-open" onClick={() => navigate('/player')} aria-label="Open the player">
        <span className="mini-art">
          {current.coverArt ? <img src={coverUrl(current.coverArt, 120)} alt="" /> : null}
        </span>
        <span className="mini-text">
          <span className="mini-title">{current.title}</span>
          <span className="mini-sub">
            {current.artist}
            <span className="mini-time"> · {formatTime(status.position)}</span>
          </span>
        </span>
      </button>
      <button className="icon-button" onClick={jbox.togglePlay} disabled={jbox.busy} aria-label={status.playing ? 'Pause' : 'Play'}>
        {status.playing ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
      </button>
      <button
        className="icon-button"
        onClick={() => jbox.step(1)}
        disabled={jbox.busy || status.currentIndex >= entries.length - 1}
        aria-label="Next track"
      >
        <NextIcon size={20} />
      </button>
      <button className="icon-button" onClick={() => navigate('/queue')} aria-label="Open the queue">
        <QueueIcon size={20} />
      </button>
    </div>
  );
}
