import { useEffect, useRef, useState } from 'react';
import { CloseIcon } from '../icons';
import { type Album, type Artist, type Song, coverUrl, getAlbums, search } from '../api';
import { Cover } from '../Cover';
import { useCounts } from '../useCounts';
import { navigate } from '../router';
import { SongRow } from '../rows';
import type { Jukebox } from '../useJukebox';

type Tab = 'albums' | 'artists';

// surviving the unmount between tab switches: refetching on every visit made the
// grid paint empty first, which reads as a reload on a phone
let albumCache: { albums: Album[]; hasMore: boolean } | null = null;

export function Library({ jbox, tab }: { jbox: Jukebox; tab: Tab }) {
  const [albums, setAlbums] = useState<Album[]>(albumCache?.albums ?? []);
  const [hasMore, setHasMore] = useState(albumCache?.hasMore ?? false);
  const counts = useCounts();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ songs: Song[]; albums: Album[]; artists: Artist[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [stuck, setStuck] = useState(false);

  // the search bar pins to the top once the title scrolls past it
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    getAlbums().then((payload) => {
      albumCache = { albums: payload.albums, hasMore: payload.hasMore };
      if (!alive) return;
      setAlbums(payload.albums);
      setHasMore(payload.hasMore);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setResults(null);
      return;
    }
    const timer = window.setTimeout(() => {
      search(text).then((payload) => {
        // an artist with no albums has nothing to open
        setResults({ ...payload, artists: payload.artists.filter((artist) => (artist.albumCount ?? 0) > 0) });
      }, () => setResults(null));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  // the hook's list is the one the artist tab renders, so its length is the pill
  const artists = counts?.artists ?? [];
  const albumTotal = counts?.albums ?? null;

  const loadMore = async () => {
    setLoading(true);
    try {
      const payload = await getAlbums(albums.length);
      setAlbums((prev) => {
        const next = [...prev, ...payload.albums];
        albumCache = { albums: next, hasMore: payload.hasMore };
        return next;
      });
      setHasMore(payload.hasMore);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view">
      <div ref={sentinel} className="library-sentinel" aria-hidden="true" />
      <div className={`library-head${stuck ? ' stuck' : ''}`}>
        <header className="view-head">
          <h1 className="display">{tab === 'albums' ? 'Albums' : 'Artists'}</h1>
          {!results && (
            <div className="segmented" role="tablist" aria-label="Browse">
              <button role="tab" aria-selected={tab === 'albums'} onClick={() => navigate('/library/albums')}>
                Albums
                {albumTotal !== null && <span className="count-pill">{albumTotal}</span>}
              </button>
              <button role="tab" aria-selected={tab === 'artists'} onClick={() => navigate('/library/artists')}>
                Artists
                {artists.length > 0 && <span className="count-pill">{artists.length}</span>}
              </button>
            </div>
          )}
        </header>
        <div className={`library-bar${stuck ? ' stuck' : ''}`}>
          <div className="searchbar">
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Songs, albums, artists"
              aria-label="Search the library"
            />
            {query && (
              <button
                className="search-clear"
                onClick={() => {
                  setQuery('');
                  input.current?.focus();
                }}
                aria-label="Clear search"
              >
                <CloseIcon size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

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
                        <Cover className="artist-avatar" src={coverUrl(artist.coverArt, 96)} />
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
                      {album.coverArt && <Cover src={coverUrl(album.coverArt, 120)} />}
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
          {tab === 'albums' ? (
            <>
              <div className="album-grid">
                {albums.map((album) => (
                  <button key={album.id} className="album-card" onClick={() => navigate(`/album/${album.id}`)}>
                    <span className="album-art">
                      {album.coverArt ? <Cover src={coverUrl(album.coverArt, 300)} /> : null}
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
                      <Cover className="artist-avatar" src={coverUrl(artist.coverArt, 96)} />
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
