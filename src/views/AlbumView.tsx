import { Fragment, useEffect, useState } from 'react';
import { type Album, type Song, coverUrl, getAlbum } from '../api';
import { Cover } from '../Cover';
import { formatTotal } from '../format';
import { ChevronLeftIcon, PlayIcon, PlusIcon } from '../icons';
import { navigate, useBack } from '../router';
import { SongRow } from '../rows';
import type { Jukebox } from '../useJukebox';

export function AlbumView({ id, jbox }: { id: string; jbox: Jukebox }) {
  const back = useBack('/library');
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

  const art = album?.coverArt ? coverUrl(album.coverArt, 600) : null;

  // a multi-disc album gets a separator before each disc's first track
  const discs = [...new Set(songs.map((song) => song.disc ?? 1))];
  const multiDisc = discs.length > 1;
  const discTitle = (disc: number) =>
    album?.discTitles?.find((entry) => entry.disc === disc)?.title ?? '';
  const discOf = (song: Song) => song.disc ?? 1;

  return (
    <div className="view album-view">
      {art ? (
        <div
          className="album-backdrop"
          style={{ ['--cover-url' as string]: `url(${art})` }}
          aria-hidden="true"
        />
      ) : null}
      <button className="back" onClick={back.go}>
        <ChevronLeftIcon size={18} /> {back.label}
      </button>

      <header className="album-head">
        <div className="album-art large">
          {art ? <Cover src={art} /> : null}
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
        </div>
      </header>


      <div className="track-table">
        <div className="track-head" aria-hidden>
          <span>#</span>
          <span>Title</span>
          <span className="track-head-time">Time</span>
          <span className="track-head-icon">
            <PlusIcon size={16} />
          </span>
        </div>
      <ul className="rows album-tracks">
        {songs.map((song, index) => (
          <Fragment key={song.id}>
          {multiDisc && (index === 0 || discOf(songs[index - 1]) !== discOf(song)) ? (
            <li className="disc-head">
              <span className="disc-number">Disc {discOf(song)}</span>
              {discTitle(discOf(song)) ? <span className="disc-name">{discTitle(discOf(song))}</span> : null}
            </li>
          ) : null}
          <SongRow
            song={song}
            number={song.track ?? index + 1}
            subtitle={null}
            favorite={jbox.favoriteIds.has(song.id)}
            active={jbox.current?.id === song.id}
            playing={jbox.status?.playing}
            onPlay={() => jbox.playFrom(songs, index)}
          />
          </Fragment>
        ))}
      </ul>
      </div>
    </div>
  );
}
