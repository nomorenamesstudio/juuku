import { formatTotal } from '../format';
import { HeartIcon, PlayIcon, PlusIcon } from '../icons';
import { SongRow } from '../rows';
import type { Jukebox } from '../useJukebox';

export function FavoritesView({ jbox }: { jbox: Jukebox }) {
  const { favorites } = jbox;
  const total = favorites.reduce((sum, song) => sum + (song.duration || 0), 0);

  return (
    <div className="view">
      <header className="view-head">
        <h1 className="display">Favorites</h1>
        <p className="fineprint">
          {favorites.length === 0 ? 'Nothing saved yet' : `${favorites.length} ${favorites.length === 1 ? 'track' : 'tracks'} · ${formatTotal(total)}`}
        </p>
        {favorites.length > 0 && (
          <div className="actions">
            <button className="primary" disabled={jbox.busy} onClick={() => jbox.playNow(favorites)}>
              <PlayIcon size={18} /> Play all
            </button>
            <button
              className="secondary"
              disabled={jbox.busy}
              onClick={() => jbox.addToQueue(favorites, 'Queued favorites')}
            >
              <PlusIcon size={18} /> Queue
            </button>
          </div>
        )}
      </header>

      {favorites.length === 0 ? (
        <p className="empty">
          Tap the heart on any track and it lands here — the playlist lives in Navidrome as “Favorites”, so other
          clients see it too.
        </p>
      ) : (
        <ul className="rows">
          {favorites.map((song) => (
            <SongRow
              key={song.id}
              song={song}
              favorite
              active={jbox.current?.id === song.id}
              playing={jbox.status?.playing}
              onAdd={() => jbox.addToQueue([song])}
              onPlay={() => jbox.playNow([song])}
              onFavorite={() => jbox.toggleFavorite(song)}
              onToggle={() => jbox.togglePlay()}
            />
          ))}
        </ul>
      )}

      <p className="fineprint tail">
        <HeartIcon size={14} filled /> marks tracks in the Navidrome playlist — remove one and it disappears from every
        client.
      </p>
    </div>
  );
}
