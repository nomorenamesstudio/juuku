import { coverUrl } from '../api';
import { formatTotal } from '../format';
import { navigate } from '../router';
import { usePlaylists } from '../usePlaylists';

/** the household convention: the playlist called Favorites is pinned above the rest */
const isFavorites = (name: string) => name.trim().toLowerCase() === 'favorites';

export function PlaylistsView({ embedded = false }: { embedded?: boolean } = {}) {
  const { playlists, loading, error: readError } = usePlaylists();
  const ordered = [...playlists].sort((a, b) => Number(isFavorites(b.name)) - Number(isFavorites(a.name)));

  const content = (
    <>
      {loading && <p className="empty">Reading playlists…</p>}
      {!loading && readError && <p className="empty">{readError}</p>}
      {!loading && !readError && playlists.length === 0 && (
        <p className="empty">
          No playlists yet. Use New playlist above, or the ⋯ menu on any track to name one and add it there.
        </p>
      )}

      <ul className="plain-list">
        {ordered.map((playlist) => (
          <li key={playlist.id}>
            <button className="link-row with-art" onClick={() => navigate(`/playlist/${playlist.id}`)}>
              {playlist.coverArt ? (
                <img src={coverUrl(playlist.coverArt, 96)} alt="" loading="lazy" />
              ) : (
                <span className="playlist-art-fallback" aria-hidden />
              )}
              <span className="link-text">
                <span className="row-title">
                  {playlist.name}
                  {isFavorites(playlist.name) && <span className="row-pin" aria-hidden>♥</span>}
                </span>
                <span className="row-sub">
                  {playlist.songCount} {playlist.songCount === 1 ? 'track' : 'tracks'} · {formatTotal(playlist.duration ?? 0)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );

  if (embedded) return content;

  return (
    <div className="view">
      <header className="view-head">
        <h1 className="display">Playlists</h1>
      </header>
      {content}
    </div>
  );
}
