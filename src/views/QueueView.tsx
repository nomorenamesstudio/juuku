import { useState } from 'react';
import { formatTime, formatTotal } from '../format';
import { RepeatIcon, RepeatOneIcon, ShuffleIcon, TrashIcon } from '../icons';
import { navigate } from '../router';
import { QueueRow } from '../rows';
import type { Jukebox } from '../useJukebox';

// how many already-played tracks stay above the current one before they fold away
const PAST_KEPT = 3;



export function QueueView({ jbox }: { jbox: Jukebox }) {
  const { entries, status } = jbox;
  const total = entries.reduce((sum, song) => sum + (song.duration || 0), 0);
  // the queue is a live list, not a page you come back to: it folds itself again on
  // every visit, and the router forgets its offset so nothing tries to restore one
  const [showPast, setShowPast] = useState(false);

  // the queue plays on its own, so the list has to keep the current track visible
  // without anyone scrolling: it folds the past away and slides forward by itself
  const index = status?.currentIndex ?? -1;
  const from = showPast ? 0 : Math.max(0, index - PAST_KEPT);
  const hidden = from;

  return (
    <div className="view">
      <header className="view-head">
        <h1 className="display">Queue</h1>
        <p className="fineprint">
          {entries.length === 0 ? 'Empty' : `${entries.length} ${entries.length === 1 ? 'track' : 'tracks'} · ${formatTotal(total)}`}
          {status && status.currentIndex >= 0
            ? ` · track ${status.currentIndex + 1}, ${Math.max(entries.length - status.currentIndex - 1, 0)} left`
            : ''}
        </p>
        {entries.length > 0 && (
          <div className="actions">
            <button className="secondary" disabled={jbox.busy} onClick={jbox.shuffleQueue}>
              <ShuffleIcon size={18} /> Shuffle
            </button>
            <button
              className="secondary"
              aria-pressed={jbox.repeat !== 'off'}
              onClick={jbox.cycleRepeat}
              title={`Repeat ${jbox.repeat}`}
            >
              {jbox.repeat === 'one' ? <RepeatOneIcon size={18} /> : <RepeatIcon size={18} />}
              {jbox.repeat === 'off' ? 'Repeat' : jbox.repeat === 'all' ? 'Repeat all' : 'Repeat one'}
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
          {hidden > 0 && (
            <li className="queue-earlier">
              <button className="inline-link" onClick={() => setShowPast(true)}>
                {hidden} earlier {hidden === 1 ? 'track' : 'tracks'}
              </button>
            </li>
          )}
          {hidden === 0 && showPast && index > PAST_KEPT && (
            <li className="queue-earlier">
              <button className="inline-link" onClick={() => setShowPast(false)}>
                Hide the {index - PAST_KEPT} earlier
              </button>
            </li>
          )}
          {entries.slice(from).map((song, offset) => {
            const at = from + offset;
            return (
            <QueueRow
              key={`${song.id}-${at}`}
              song={song}
              index={at}
              active={at === index}
              played={index >= 0 && at < index}
              playing={!!status?.playing}
              onSkip={() => jbox.playAt(at)}
              onRemove={() => jbox.removeAt(at)}
            />
            );
          })}
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
