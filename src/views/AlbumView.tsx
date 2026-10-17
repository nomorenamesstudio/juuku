import { useEffect, useState } from 'react';
import { type Album, type Song, coverUrl, getAlbum } from '../api';
import { formatTotal } from '../format';
import { ChevronLeftIcon, HeartIcon, PlayIcon, PlusIcon } from '../icons';
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
          <div className="album-title">
            <h1 className="display">{album?.name ?? '…'}</h1>
          </div>
          <p className="album-facts">
            {album?.artistId ? (
              <button className="artist-link" onClick={() => navigate(`/artist/${album.artistId}`)}>
                {album.artist}
              </button>
            ) : (
              album?.artist
            )}{' '}
            {album?.year ? (
              <>
                · <span className="fact">{album.year}</span>{' '}
              </>
            ) : null}
            · <span className="fact">{songs.length} tracks</span> ·{' '}
            <span className="fact">{
              formatTotal(songs.reduce((sum, song) => sum + (song.duration || 0), 0))
            }</span>
          </p>
        </div>
      </header>

      <div className="actions album-actions">
        <button className="primary" disabled={jbox.busy || songs.length === 0} onClick={() => jbox.playNow(songs)}>
          <PlayIcon size={18} /> Play album
        </button>
        <button
          className="secondary"
          disabled={jbox.busy || songs.length === 0}
          onClick={() => jbox.addToQueue(songs, `Queued ${album?.name}`)}
        >
          <PlusIcon size={18} /> Add to queue
        </button>
      </div>

      <div className="track-table">
        <div className="track-head" aria-hidden>
          <span>#</span>
          <span>Title</span>
          <span className="track-head-time">Time</span>
          <span className="track-head-icon">
            <HeartIcon size={16} />
          </span>
          <span className="track-head-icon">
            <PlusIcon size={16} />
          </span>
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
            onPlay={() => jbox.playFrom(songs, index)}
            onFavorite={() => jbox.toggleFavorite(song)}
          />
        ))}
      </ul>
      </div>
    </div>
  );
}
