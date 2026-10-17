import { formatTime, formatTotal } from '../format';
import { ShuffleIcon, TrashIcon } from '../icons';
import { navigate } from '../router';
import { QueueRow } from '../rows';
import type { Jukebox } from '../useJukebox';

export function QueueView({ jbox }: { jbox: Jukebox }) {
  const { entries, status } = jbox;
  const total = entries.reduce((sum, song) => sum + (song.duration || 0), 0);

  return (
    <div className="view">
      <header className="view-head">
        <h1 className="display">Queue</h1>
        <p className="fineprint">
          {entries.length === 0 ? 'Empty' : `${entries.length} ${entries.length === 1 ? 'track' : 'tracks'} · ${formatTotal(total)}`}
          {status && status.currentIndex >= 0 ? ` · playing track ${status.currentIndex + 1}` : ''}
        </p>
        {entries.length > 0 && (
          <div className="actions">
            <button className="secondary" disabled={jbox.busy} onClick={jbox.shuffleQueue}>
              <ShuffleIcon size={18} /> Shuffle
            </button>
            <button className="secondary danger" disabled={jbox.busy} onClick={jbox.clearQueue}>
              <TrashIcon size={18} /> Clear
            </button>
          </div>
        )}
      </header>

      {entries.length === 0 ? (
        <p className="empty">
          Nothing queued. Pick an album in the <button className="inline-link" onClick={() => navigate('/library')}>library</button> —
          tapping a track adds it here, ▶ plays it now.
        </p>
      ) : (
        <ul className="rows">
          {entries.map((song, index) => (
            <QueueRow
              key={`${song.id}-${index}`}
              song={song}
              index={index}
              active={index === status?.currentIndex}
              playing={!!status?.playing}
              onSkip={() => jbox.playAt(index)}
              onRemove={() => jbox.removeAt(index)}
            />
          ))}
        </ul>
      )}

      {entries.length > 0 && status && (
        <p className="fineprint tail">
          Position {formatTime(status.position)} in the current track · volume {Math.round(status.gain * 100)}%
        </p>
      )}
    </div>
  );
}
