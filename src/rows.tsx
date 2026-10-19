import type { Song } from './api';
import { formatTime } from './format';
import { CloseIcon, HeartIcon, MoreIcon } from './icons';
import { useTrackActions } from './TrackActions';

export function Eq({ playing }: { playing: boolean }) {
  return (
    <span className={`eq ${playing ? 'on' : ''}`} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

interface SongRowProps {
  song: Song;
  favorite: boolean;
  active?: boolean;
  playing?: boolean;
  number?: number;
  subtitle?: string | null;
  onPlay: () => void;
  onFavorite: () => void;
  /** Overrides the default "more actions" sheet (e.g. to add a playlist context). */
  onMenu?: () => void;
}

/** Library row: tapping the row queues the track, the ▶ button plays it now. */
export function SongRow({
  song,
  favorite,
  active,
  playing,
  number,
  subtitle,
  onPlay,
  onFavorite,
  onMenu,
}: SongRowProps) {
  const openActions = useTrackActions();
  return (
    <li className={`row ${active ? 'row-active' : ''}`}>
      {number !== undefined && (
        <span className="row-number">{active ? <Eq playing={!!playing} /> : number}</span>
      )}
      <button className="row-main" onClick={onPlay} aria-label={`Play ${song.title}`}>
        <span className="row-title">{song.title}</span>
        {subtitle !== null && <span className="row-sub">{subtitle ?? `${song.artist} · ${song.album}`}</span>}
      </button>
      <span className="row-time">{formatTime(song.duration)}</span>
      <button
        className={`row-icon fav ${favorite ? 'is-fav' : ''}`}
        onClick={onFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? `Remove ${song.title} from favorites` : `Favorite ${song.title}`}
        title={favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <HeartIcon filled={favorite} size={18} />
      </button>
      <button
        className="row-icon"
        onClick={onMenu ?? (() => openActions([song]))}
        aria-label={`More actions for ${song.title}`}
        title="More actions"
      >
        <MoreIcon size={18} />
      </button>
    </li>
  );
}

interface QueueRowProps {
  song: Song;
  index: number;
  active: boolean;
  played: boolean;
  playing: boolean;
  onSkip: () => void;
  onRemove: () => void;
}

/** Queue row: tapping skips to that entry, past entries fade but stay. */
export function QueueRow({ song, index, active, played, playing, onSkip, onRemove }: QueueRowProps) {
  return (
    <li className={`row ${active ? 'row-active' : ''} ${played ? 'row-played' : ''}`}>
      <span className="row-number">{active ? <Eq playing={playing} /> : index + 1}</span>
      <button className="row-main" onClick={onSkip} aria-label={`Skip to ${song.title}`}>
        <span className="row-title">{song.title}</span>
        <span className="row-sub">{song.artist}</span>
      </button>
      <span className="row-time">{formatTime(song.duration)}</span>
      <button
        className="row-icon"
        onClick={onRemove}
        aria-label={`Remove ${song.title} from queue`}
        title="Remove from queue"
      >
        <CloseIcon size={18} />
      </button>
    </li>
  );
}
