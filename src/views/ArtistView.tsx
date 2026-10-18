import { useEffect, useState } from 'react';
import { type Album, type Artist, coverUrl, getArtist, getArtistSongs } from '../api';
import { Cover } from '../Cover';
import { ChevronLeftIcon, PlayIcon } from '../icons';
import { navigate, useBack } from '../router';
import type { Jukebox } from '../useJukebox';

export function ArtistView({ id, jbox }: { id: string; jbox: Jukebox }) {
  const back = useBack('/library');
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    getArtist(id).then((payload) => {
      setArtist(payload.artist);
      setAlbums(payload.albums);
    });
  }, [id]);

  const playAll = async () => {
    setLoadingAll(true);
    try {
      const { songs } = await getArtistSongs(id);
      if (songs.length) await jbox.playNow(songs);
    } finally {
      setLoadingAll(false);
    }
  };

  return (
    <div className="view">
      <button className="back" onClick={back.go}>
        <ChevronLeftIcon size={18} /> {back.label}
      </button>
      <header className="view-head artist-head">
        <div className="artist-heading">
          <h1 className="display">{artist?.name ?? '…'}</h1>
          <button
            className="secondary compact"
            disabled={jbox.busy || loadingAll || albums.length === 0}
            onClick={playAll}
          >
            <PlayIcon size={16} /> {loadingAll ? 'Loading…' : 'Play all'}
          </button>
        </div>
        <p className="fineprint">
          {albums.length} {albums.length === 1 ? 'album' : 'albums'}
        </p>
      </header>
      <div className="album-grid">
        {albums.map((album) => (
          <button key={album.id} className="album-card" onClick={() => navigate(`/album/${album.id}`)}>
            <span className="album-art">
              {album.coverArt ? <Cover src={coverUrl(album.coverArt, 300)} loading="lazy" /> : null}
            </span>
            <span className="album-name">{album.name}</span>
            <span className="album-artist">{album.year ?? ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
