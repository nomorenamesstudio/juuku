import { useEffect, useState } from 'react';
import { type Album, type Song, coverUrl, getAlbum } from '../api';
import { formatTotal } from '../format';
import { ChevronLeftIcon, PlayIcon, PlusIcon } from '../icons';
import { navigate } from '../router';
import { SongRow } from '../rows';
import type { Jukebox } from '../useJukebox';

export function AlbumView({ id, jbox }: { id: string; jbox: Jukebox }) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAlbum(null);
    getAlbum(id).then(
      (payload) => {
        setAlbum(payload.album);
        setSongs(payload.songs);
      },
      (err: Error) => setError(err.message),
    );
  }, [id]);

  if (error) return <p className="empty">{error}</p>;

  return (
    <div className="view">
      <button className="back" onClick={() => navigate('/library')}>
        <ChevronLeftIcon size={18} /> Library
      </button>

      <header className="album-head">
        <div className="album-art large">
          {album?.coverArt ? <img src={coverUrl(album.coverArt, 600)} alt="" /> : null}
        </div>
        <div className="album-meta">
          <h1 className="display">{album?.name ?? '…'}</h1>
          <p className="byline">{album?.artist}</p>
          <p className="fineprint">
            {album?.year ? `${album.year} · ` : ''}
            {songs.length} tracks · {formatTotal(songs.reduce((sum, song) => sum + (song.duration || 0), 0))}
          </p>
        </div>
      </header>

      <div className="actions">
        <button className="primary" disabled={jbox.busy || songs.length === 0} onClick={() => jbox.playNow(songs)}>
          <PlayIcon size={18} /> Play album
        </button>
        <button
          className="secondary"
          disabled={jbox.busy || songs.length === 0}
          onClick={() => jbox.addToQueue(songs, `Queued ${album?.name}`)}
        >
          <PlusIcon size={18} /> Queue
        </button>
      </div>

      <ul className="rows album-tracks">
        {songs.map((song, index) => (
          <SongRow
            key={song.id}
            song={song}
            number={song.track ?? index + 1}
            subtitle={null}
            favorite={jbox.favoriteIds.has(song.id)}
            active={jbox.current?.id === song.id}
            playing={jbox.status?.playing}
            onAdd={() => jbox.addToQueue([song])}
            onPlay={() => jbox.playNow([song])}
            onFavorite={() => jbox.toggleFavorite(song)}
            onToggle={() => jbox.togglePlay()}
          />
        ))}
      </ul>
    </div>
  );
}
