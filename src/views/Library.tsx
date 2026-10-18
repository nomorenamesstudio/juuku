import { useEffect, useState } from 'react';
import { ChevronDownIcon, RefreshIcon } from '../icons';
import { type Album, type AlbumSort, coverUrl, getAlbums } from '../api';
import { Cover } from '../Cover';
import { useCounts } from '../useCounts';
import { readPref, writePref } from '../prefs';
import { navigate } from '../router';

type Tab = 'albums' | 'artists';

const SORTS = [
  { type: 'alphabeticalByName', label: 'Alphabetical' },
  { type: 'newest', label: 'Last added' },
  { type: 'recent', label: 'Last played' },
  { type: 'byYear', label: 'Last released' },
] as const;

const SORT_KEY = 'juuku.library.sort';

function readSort(): AlbumSort {
  const stored = readPref<string>(SORT_KEY, 'newest');
  return (SORTS.find((sort) => sort.type === stored)?.type ?? 'newest') as AlbumSort;
}

// surviving the unmount between tab switches: refetching on every visit made the
// grid paint empty first, which reads as a reload on a phone
let albumCache: { albums: Album[]; hasMore: boolean; sort: AlbumSort } | null = null;

export function Library({ tab }: { tab: Tab }) {
  const [sort, setSort] = useState<AlbumSort>(readSort);
  const [albums, setAlbums] = useState<Album[]>(albumCache?.sort === readSort() ? albumCache.albums : []);
  const [hasMore, setHasMore] = useState(albumCache?.sort === readSort() ? albumCache.hasMore : false);
  const counts = useCounts();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    getAlbums(0, 30, sort).then((payload) => {
      albumCache = { albums: payload.albums, hasMore: payload.hasMore, sort };
      if (!alive) return;
      setAlbums(payload.albums);
      setHasMore(payload.hasMore);
    });
    return () => {
      alive = false;
    };
  }, [sort]);

  const changeSort = (next: AlbumSort) => {
    writePref(SORT_KEY, next);
    albumCache = null;
    setAlbums([]);
    setHasMore(false);
    setSort(next);
  };

  // the hook's list is the one the artist tab renders, so its length is the pill
  const artists = counts?.artists ?? [];
  const albumTotal = counts?.albums ?? null;

  const loadMore = async () => {
    setLoading(true);
    try {
      const payload = await getAlbums(albums.length, 30, sort);
      setAlbums((prev) => {
        const next = [...prev, ...payload.albums];
        albumCache = { albums: next, hasMore: payload.hasMore, sort };
        return next;
      });
      setHasMore(payload.hasMore);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view">
      <div className="library-head">
        <header className="view-head">
          <h1 className="display">{tab === 'albums' ? 'Albums' : 'Artists'}</h1>
          <div className="library-controls">
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
            {tab === 'albums' && (
              <label className="sort-select">
                <span className="visually-hidden">Sort albums</span>
                <select value={sort} onChange={(event) => changeSort(event.target.value as AlbumSort)}>
                  {SORTS.map((option) => (
                    <option key={option.type} value={option.type}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon size={15} aria-hidden />
              </label>
            )}
          </div>
        </header>
      </div>

    {tab === 'albums' ? (
        <>
          {albums.length === 0 && (
            <p className="empty">
              {sort === 'recent'
                ? 'Nothing played through Navidrome yet — jukebox playback is not scrobbled, so this list stays empty.'
                : 'No albums here yet.'}
            </p>
          )}
          <div className="album-grid">
            {albums.map((album) => (
              <button key={album.id} className="album-card" onClick={() => navigate(`/album/${album.id}`)}>
                <span className="album-art">
                  {album.coverArt ? <Cover src={coverUrl(album.coverArt, 300)} /> : null}
                </span>
                <span className="album-name">{album.name}</span>
                <span className="album-artist">
                  <span className="album-artist-name">{album.artist}</span>
                  {album.year ? <span className="album-year">· {album.year}</span> : null}
                </span>
              </button>
            ))}
          </div>
          {hasMore && (
            <button className="more" onClick={loadMore} disabled={loading}>
              {loading ? <RefreshIcon size={16} className="spin" /> : <ChevronDownIcon size={16} />}
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
    </div>
  );
}
