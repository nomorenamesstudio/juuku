import { useEffect, useState } from 'react';
import { type Album, type Artist, type Song, coverUrl, getAlbums, getArtists, search } from '../api';
import { navigate } from '../router';
import { SongRow } from '../rows';
import type { Jukebox } from '../useJukebox';

type Tab = 'albums' | 'artists';

export function Library({ jbox, tab }: { jbox: Jukebox; tab: Tab }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ songs: Song[]; albums: Album[]; artists: Artist[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAlbums().then((payload) => {
      setAlbums(payload.albums);
      setHasMore(payload.hasMore);
    });
  }, []);

  useEffect(() => {
    if (tab !== 'artists' || artists.length > 0) return;
    getArtists().then((payload) => setArtists(payload.artists));
  }, [tab, artists.length]);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setResults(null);
      return;
    }
    const timer = window.setTimeout(() => {
      search(text).then(setResults, () => setResults(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const payload = await getAlbums(albums.length);
      setAlbums((prev) => [...prev, ...payload.albums]);
      setHasMore(payload.hasMore);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view">
      <header className="view-head">
        <h1 className="display">{tab === 'albums' ? 'Albums' : 'Artists'}</h1>
        <div className="searchbar">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Songs, albums, artists"
            aria-label="Search the library"
          />
        </div>
      </header>

      {results ? (
        <div className="search-results">
          {results.songs.length === 0 && results.albums.length === 0 && results.artists.length === 0 && (
            <p className="empty">Nothing matches “{query}”.</p>
          )}
          {results.artists.length > 0 && (
            <section>
              <h2 className="section-label">Artists</h2>
              <ul className="plain-list">
                {results.artists.map((artist) => (
                  <li key={artist.id}>
                    <button className="link-row with-art" onClick={() => navigate(`/artist/${artist.id}`)}>
                      {artist.coverArt ? (
                        <img className="artist-avatar" src={coverUrl(artist.coverArt, 96)} alt="" loading="lazy" />
                      ) : (
                        <span className="artist-avatar empty" aria-hidden>
                          {artist.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="link-text">
                        <span className="row-title">{artist.name}</span>
                        <span className="row-sub">{artist.albumCount} albums</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.albums.length > 0 && (
            <section>
              <h2 className="section-label">Albums</h2>
              <ul className="plain-list">
                {results.albums.map((album) => (
                  <li key={album.id}>
                    <button className="link-row with-art" onClick={() => navigate(`/album/${album.id}`)}>
                      {album.coverArt && <img src={coverUrl(album.coverArt, 120)} alt="" />}
                      <span className="link-text">
                        <span className="row-title">{album.name}</span>
                        <span className="row-sub">{album.artist}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.songs.length > 0 && (
            <section>
              <h2 className="section-label">Songs</h2>
              <ul className="rows">
                {results.songs.map((song) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    favorite={jbox.favoriteIds.has(song.id)}
                    active={jbox.current?.id === song.id}
                    playing={jbox.status?.playing}
                    onPlay={() => jbox.playNow([song])}
                    onFavorite={() => jbox.toggleFavorite(song)}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <>
          <div className="segmented" role="tablist" aria-label="Browse">
            <button role="tab" aria-selected={tab === 'albums'} onClick={() => navigate('/library/albums')}>
              Albums
            </button>
            <button role="tab" aria-selected={tab === 'artists'} onClick={() => navigate('/library/artists')}>
              Artists
            </button>
          </div>

          {tab === 'albums' ? (
            <>
              <div className="album-grid">
                {albums.map((album) => (
                  <button key={album.id} className="album-card" onClick={() => navigate(`/album/${album.id}`)}>
                    <span className="album-art">
                      {album.coverArt ? <img src={coverUrl(album.coverArt, 300)} alt="" loading="lazy" /> : null}
                    </span>
                    <span className="album-name">{album.name}</span>
                    <span className="album-artist">{album.artist}</span>
                  </button>
                ))}
              </div>
              {hasMore && (
                <button className="more" onClick={loadMore} disabled={loading}>
                  {loading ? 'Loading…' : 'Load more albums'}
                </button>
              )}
            </>
          ) : (
            <ul className="plain-list">
              {artists.map((artist) => (
                <li key={artist.id}>
                  <button className="link-row with-art" onClick={() => navigate(`/artist/${artist.id}`)}>
                    {artist.coverArt ? (
                      <img className="artist-avatar" src={coverUrl(artist.coverArt, 96)} alt="" loading="lazy" />
                    ) : (
                      <span className="artist-avatar empty" aria-hidden>
                        {artist.name.slice(0, 1)}
                      </span>
                    )}
                    <span className="link-text">
                      <span className="row-title">{artist.name}</span>
                      <span className="row-sub">
                        {artist.albumCount} {artist.albumCount === 1 ? 'album' : 'albums'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
