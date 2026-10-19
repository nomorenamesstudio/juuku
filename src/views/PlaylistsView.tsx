import { useState } from 'react';
import { coverUrl } from '../api';
import { formatTime } from '../format';
import { PlusIcon } from '../icons';
import { navigate } from '../router';
import { usePlaylists } from '../usePlaylists';

/** the household convention: the playlist called Favorites is pinned above the rest */
const isFavorites = (name: string) => name.trim().toLowerCase() === 'favorites';

export function PlaylistsView({ embedded = false }: { embedded?: boolean } = {}) {
  const { playlists, loading, create } = usePlaylists();
  const ordered = [...playlists].sort((a, b) => Number(isFavorites(b.name)) - Number(isFavorites(a.name)));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const playlist = await create(trimmed);
      setName('');
      navigate(`/playlist/${playlist.id}`);
    } finally {
      setBusy(false);
    }
  };

  const content = (
    <>
      <form
        className="playlist-new"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New playlist name"
          aria-label="New playlist name"
        />
        <button className="primary" type="submit" disabled={busy || !name.trim()}>
          <PlusIcon size={18} /> Create
        </button>
      </form>

      {loading && <p className="empty">Reading playlists…</p>}
      {!loading && playlists.length === 0 && (
        <p className="empty">
          No playlists yet. Name one above, or use the ⋯ menu on any track and pick “New playlist”.
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
                  {playlist.songCount} {playlist.songCount === 1 ? 'track' : 'tracks'} · {formatTime(playlist.duration)}
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
