import { useEffect, useState } from 'react';
import { type Playlist, type Song, coverUrl, getPlaylist } from '../api';
import { formatTotal } from '../format';
import { ChevronLeftIcon, PlayIcon, PlusIcon } from '../icons';
import { navigate } from '../router';
import { SongRow } from '../rows';
import { useTrackActions } from '../TrackActions';
import type { Jukebox } from '../useJukebox';

export function PlaylistView({ id, jbox }: { id: string; jbox: Jukebox }) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);
  const openActions = useTrackActions();

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
      </div>

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
    </div>
  );
}
