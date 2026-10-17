import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Playlist, type Song, coverUrl, deletePlaylist, getPlaylist } from '../api';
import { formatTotal } from '../format';
import { ChevronLeftIcon, PlayIcon, PlusIcon, TrashIcon } from '../icons';
import { navigate } from '../router';
import { SongRow } from '../rows';
import { useTrackActions } from '../TrackActions';
import type { Jukebox } from '../useJukebox';

export function PlaylistView({ id, jbox }: { id: string; jbox: Jukebox }) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);
  const openActions = useTrackActions();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await deletePlaylist(id);
      jbox.notify(`Deleted ${playlist?.name ?? 'playlist'}`);
      navigate('/playlists');
    } catch (err) {
      jbox.notify((err as Error).message);
      setDeleting(false);
      setConfirming(false);
    }
  };

  useEffect(() => {
    setPlaylist(null);
    getPlaylist(id).then(
      (payload) => {
        setPlaylist(payload.playlist);
        setSongs(payload.songs);
      },
      (err: Error) => setError(err.message),
    );
  }, [id]);

  if (error) return <p className="empty">{error}</p>;

  return (
    <div className="view">
      <button className="back" onClick={() => navigate('/playlists')}>
        <ChevronLeftIcon size={18} /> Playlists
      </button>

      <header className="album-head">
        <div className="album-art large">
          {playlist?.coverArt ? <img src={coverUrl(playlist.coverArt, 600)} alt="" /> : null}
        </div>
        <div className="album-meta">
          <h1 className="display">{playlist?.name ?? '…'}</h1>
          <p className="album-facts">
            {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
            {songs.length > 0 ? ` · ${formatTotal(songs.reduce((sum, song) => sum + (song.duration || 0), 0))}` : ''}
          </p>
        </div>
      </header>

      <div className="actions album-actions">
        <button className="primary" disabled={jbox.busy || songs.length === 0} onClick={() => jbox.playNow(songs)}>
          <PlayIcon size={18} /> Play all
        </button>
        <button
          className="secondary"
          disabled={jbox.busy || songs.length === 0}
          onClick={() => jbox.addToQueue(songs, `Queued ${playlist?.name}`)}
        >
          <PlusIcon size={18} /> Add to queue
        </button>
        {!playlist?.protected && (
          <button className="secondary danger" disabled={!playlist} onClick={() => setConfirming(true)}>
            <TrashIcon size={18} /> Delete
          </button>
        )}
      </div>

      {playlist?.protected && songs.length > 0 && (
        <p className="fineprint">Filled by the heart button on any track, so this one can’t be deleted.</p>
      )}

      {songs.length === 0 ? (
        <p className="empty">
          Empty for now. Use the ⋯ menu on any track to add it here.
        </p>
      ) : (
        <ul className="rows">
          {songs.map((song, index) => (
            <SongRow
              key={`${song.id}-${index}`}
              song={song}
              favorite={jbox.favoriteIds.has(song.id)}
              active={jbox.current?.id === song.id}
              playing={jbox.status?.playing}
              onPlay={() => jbox.playFrom(songs, index)}
              onFavorite={() => jbox.toggleFavorite(song)}
              onMenu={() => openActions([song], { playlistId: id })}
            />
          ))}
        </ul>
      )}

      {confirming &&
        createPortal(
          <div className="sheet-layer" onClick={() => !deleting && setConfirming(false)} role="presentation">
          <div
            className="sheet confirm"
            role="alertdialog"
            aria-modal="true"
            aria-label="Delete playlist"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sheet-head">
              <div>
                <p className="sheet-eyebrow">Delete “{playlist?.name}”?</p>
                <p className="sheet-sub">The playlist goes, the tracks stay in your library.</p>
              </div>
            </header>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => setConfirming(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="danger-solid" onClick={() => void remove()} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete playlist'}
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
