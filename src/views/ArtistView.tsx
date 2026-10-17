import { useEffect, useState } from 'react';
import { type Album, type Artist, coverUrl, getArtist } from '../api';
import { ChevronLeftIcon } from '../icons';
import { navigate, useBack } from '../router';

export function ArtistView({ id }: { id: string }) {
  const back = useBack('/library');
  const [artist, setArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);

  useEffect(() => {
    getArtist(id).then((payload) => {
      setArtist(payload.artist);
      setAlbums(payload.albums);
    });
  }, [id]);

  return (
    <div className="view">
      <button className="back" onClick={back.go}>
        <ChevronLeftIcon size={18} /> {back.label}
      </button>
      <header className="view-head">
        <h1 className="display">{artist?.name ?? '…'}</h1>
        <p className="fineprint">
          {albums.length} {albums.length === 1 ? 'album' : 'albums'}
        </p>
      </header>
      <div className="album-grid">
        {albums.map((album) => (
          <button key={album.id} className="album-card" onClick={() => navigate(`/album/${album.id}`)}>
            <span className="album-art">
              {album.coverArt ? <img src={coverUrl(album.coverArt, 300)} alt="" loading="lazy" /> : null}
            </span>
            <span className="album-name">{album.name}</span>
            <span className="album-artist">{album.year ?? ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
