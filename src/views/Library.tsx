import { useEffect, useState } from 'react';
import { AlbumsIcon, ArtistIcon, ChevronDownIcon, PlaylistIcon, PlusIcon, RefreshIcon } from '../icons';
import { NewPlaylistSheet } from '../NewPlaylistSheet';
import { type Album, type AlbumSort, coverUrl, getAlbums } from '../api';
import { Cover } from '../Cover';
import { useCounts } from '../useCounts';
import { readPref, writePref } from '../prefs';
import { type LibraryTab, navigate } from '../router';
import { PlaylistsView } from './PlaylistsView';

const SORTS = [
  { type: 'alphabeticalByName', label: 'Alphabetical' },
  { type: 'alphabeticalByArtist', label: 'By artist' },
  { type: 'newest', label: 'Last added' },
  { type: 'recent', label: 'Last played' },
  { type: 'byYear', label: 'Last released' },
  { type: 'daily', label: 'Daily picks' },
] as const;

const SORT_KEY = 'juuku.library.sort';

function readSort(): AlbumSort {
  const stored = readPref<string>(SORT_KEY, 'newest');
  return (SORTS.find((sort) => sort.type === stored)?.type ?? 'newest') as AlbumSort;
}

// surviving the unmount between tab switches: refetching on every visit made the
// grid paint empty first, which reads as a reload on a phone
let albumCache: { albums: Album[]; hasMore: boolean; sort: AlbumSort } | null = null;

export function Library({ tab }: { tab: LibraryTab }) {
  const [sort, setSort] = useState<AlbumSort>(readSort);
  const [albums, setAlbums] = useState<Album[]>(albumCache?.sort === readSort() ? albumCache.albums : []);
  const [hasMore, setHasMore] = useState(albumCache?.sort === readSort() ? albumCache.hasMore : false);
  const counts = useCounts();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // the first page is on its way: an empty grid under "no albums here yet" was a lie
  // for however long the request took, which on a phone over a tunnel is seconds
  const [fetching, setFetching] = useState(albumCache === null);
  const [naming, setNaming] = useState(false);

  useEffect(() => {
    // the shell remounts this view on every route change (the content element is
    // keyed by route), so a cached list must not be thrown away for page one: that
    // left the grid at 30 albums and the restored scroll with nowhere to go
    if (albumCache?.sort === sort && albumCache.albums.length > 0) {
      setAlbums(albumCache.albums);
      setHasMore(albumCache.hasMore);
      setFetching(false);
      return;
    }
    let alive = true;
    setFailed(false);
    setFetching(true);
    getAlbums(0, 30, sort).then(
      (payload) => {
        albumCache = { albums: payload.albums, hasMore: payload.hasMore, sort };
        if (!alive) return;
        setAlbums(payload.albums);
        setHasMore(payload.hasMore);
        setFetching(false);
      },
      // a rejection used to escape as an unhandled promise and leave "no albums here"
      (err: Error) => {
        if (alive) {
          setFailed(true);
          setFetching(false);
        }
        console.warn(`albums not read: ${err.message}`);
      },
    );
    return () => {
      alive = false;
    };
  }, [sort]);

  const changeSort = (next: AlbumSort) => {
    // re-picking the current order must not empty the grid and refetch it
    if (next === sort) return;
    writePref(SORT_KEY, next);
    albumCache = null;
    setAlbums([]);
    setHasMore(false);
    setSort(next);
    // a new order is a new list: staying 5000px down it is disorienting
    window.scrollTo({ top: 0 });
  };

  // the hook's list is the one the artist tab renders, so its length is the pill
  const artists = counts?.artists ?? [];
  const albumTotal = counts?.albums ?? null;
  const playlistTotal = counts?.playlists ?? null;

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
    } catch (err) {
      setFailed(true);
      console.warn(`more albums not read: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view">
      <div className="library-head">
        <header className="view-head">
          <h1 className="display">{tab === 'albums' ? 'Albums' : tab === 'artists' ? 'Artists' : 'Playlists'}</h1>
          <div className="library-controls">
            <div className="segmented" role="tablist" aria-label="Browse">
              <button
                role="tab"
                aria-selected={tab === 'albums'}
                aria-label="Albums"
                title="Albums"
                onClick={() => navigate('/library/albums')}
              >
                <AlbumsIcon size={17} />
                {albumTotal !== null && <span className="count-pill">{albumTotal}</span>}
              </button>
              <button
                role="tab"
                aria-selected={tab === 'artists'}
                aria-label="Artists"
                title="Artists"
                onClick={() => navigate('/library/artists')}
              >
                <ArtistIcon size={17} />
                {artists.length > 0 && <span className="count-pill">{artists.length}</span>}
              </button>
              <button
                role="tab"
                aria-selected={tab === 'playlists'}
                aria-label="Playlists"
                title="Playlists"
                onClick={() => navigate('/library/playlists')}
              >
                <PlaylistIcon size={17} />
                {playlistTotal !== null && <span className="count-pill">{playlistTotal}</span>}
              </button>
            </div>
            {tab === 'playlists' && (
              <button className="secondary new-playlist" onClick={() => setNaming(true)} aria-label="New playlist">
                <PlusIcon size={16} />
                New playlist
              </button>
            )}
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

      {naming && <NewPlaylistSheet onClose={() => setNaming(false)} />}

    {tab === 'playlists' ? (
        <PlaylistsView embedded />
      ) : tab === 'albums' ? (
        <>
          {albums.length === 0 && (
            <p className="empty">
              {fetching
                ? 'Reading the library…'
                : failed
                  ? 'Could not read the library just now.'
                  : sort === 'recent'
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
          {!hasMore && !loading && albums.length > 0 && (
            // a list that simply stops reads as a broken button, which is exactly how
            // "last played" (twenty-something albums, no more to load) was reported
            <p className="fineprint tail end-of-list">
              {sort === 'recent'
                ? `That's the whole last-played list — ${albums.length} ${albums.length === 1 ? 'album' : 'albums'}.`
                : `That's all ${albums.length} ${albums.length === 1 ? 'album' : 'albums'}.`}{' '}
              {sort !== 'alphabeticalByName' && (
                <button className="inline-link" onClick={() => changeSort('alphabeticalByName')}>
                  Show all albums
                </button>
              )}
            </p>
          )}
        </>
      ) : (
        <ul className="plain-list artists">
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
