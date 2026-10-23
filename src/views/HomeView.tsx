import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { type Album, type AlbumSort, type Artist, type HomeRows, type Playlist, coverUrl, getHome } from '../api';
import { Cover } from '../Cover';
import { formatTotal } from '../format';
import { ChevronLeftIcon } from '../icons';
import { writePref } from '../prefs';
import { navigate } from '../router';

export const SORT_KEY = 'juuku.library.sort';

type AlbumShelfKey = 'lastPlayed' | 'lastAdded' | 'newestRelease' | 'dailyPicks';

const SHELVES: { key: AlbumShelfKey; title: string; sort: AlbumSort }[] = [
  { key: 'lastPlayed', title: 'Last played albums', sort: 'recent' },
  { key: 'lastAdded', title: 'Last added', sort: 'newest' },
  { key: 'newestRelease', title: 'Newest release', sort: 'byYear' },
  { key: 'dailyPicks', title: 'Daily picks', sort: 'daily' },
];

// the shelves are re-read when the screen is opened after a while: Last played only
// moves when something plays, and a cached first load hid that
let cache: { at: number; rows: HomeRows } | null = null;
const CACHE_MS = 30_000;

function useShelf() {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = () => {
    const node = track.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setEdges({ start: node.scrollLeft <= 2, end: node.scrollLeft >= max - 2 });
  };

  useEffect(() => {
    const node = track.current;
    if (!node) return;
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, []);

  const step = (direction: 1 | -1) => {
    const node = track.current;
    if (!node) return;
    // two fifths of the track, so a step keeps two cards of context on screen
    node.scrollBy({ left: direction * Math.round(node.clientWidth * 0.4), behavior: 'smooth' });
  };

  return { track, step, edges };
}

function Shelf({ title, albums, sort }: { title: string; albums: Album[]; sort: AlbumSort }) {
  const { track, step, edges } = useShelf();
  if (albums.length === 0) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2 className="section-label">{title}</h2>
        <div className="shelf-tools">
          <button
            className="icon-button shelf-step"
            onClick={() => step(-1)}
            disabled={edges.start}
            aria-label={`Scroll ${title} back`}
            title="Back"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            className="icon-button shelf-step"
            onClick={() => step(1)}
            disabled={edges.end}
            aria-label={`Scroll ${title} on`}
            title="More"
          >
            <ChevronLeftIcon size={16} className="flip" />
          </button>
          <button
            className="back shelf-all"
            onClick={() => {
              writePref(SORT_KEY, sort);
              navigate('/library/albums');
            }}
          >
            See all <ChevronLeftIcon size={16} className="flip" />
          </button>
        </div>
      </div>
      <div className="shelf-track" ref={track}>
        {albums.map((album) => (
          <button key={album.id} className="shelf-card" onClick={() => navigate(`/album/${album.id}`)}>
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
    </section>
  );
}

/** The other history row: the playlists started from here, not from Navidrome. */
function PlaylistShelf({ playlists }: { playlists: Playlist[] }) {
  const { track, step, edges } = useShelf();
  if (playlists.length === 0) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2 className="section-label">Last played playlists</h2>
        <div className="shelf-tools">
          <button
            className="icon-button shelf-step"
            onClick={() => step(-1)}
            disabled={edges.start}
            aria-label="Scroll the last played playlists back"
            title="Back"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            className="icon-button shelf-step"
            onClick={() => step(1)}
            disabled={edges.end}
            aria-label="Scroll the last played playlists on"
            title="More"
          >
            <ChevronLeftIcon size={16} className="flip" />
          </button>
          <button className="back shelf-all" onClick={() => navigate('/library/playlists')}>
            See all <ChevronLeftIcon size={16} className="flip" />
          </button>
        </div>
      </div>
      <div className="shelf-track" ref={track}>
        {playlists.map((playlist) => (
          <button key={playlist.id} className="shelf-card" onClick={() => navigate(`/playlist/${playlist.id}`)}>
            <span className="album-art">
              {playlist.coverArt ? <Cover src={coverUrl(playlist.coverArt, 300)} /> : null}
            </span>
            <span className="album-name">{playlist.name}</span>
            <span className="album-artist">
              {playlist.missing ? (
                <span className="album-artist-name">no longer in the library</span>
              ) : (
                <>
                  <span className="album-artist-name">
                    {playlist.songCount} {playlist.songCount === 1 ? 'track' : 'tracks'}
                  </span>
                  {playlist.duration ? <span className="album-year">· {formatTotal(playlist.duration)}</span> : null}
                </>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ArtistShelf({ artists, onSeeAll }: { artists: Artist[]; onSeeAll: () => void }) {
  const { track, step, edges } = useShelf();
  if (artists.length === 0) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2 className="section-label">Daily artists</h2>
        <div className="shelf-tools">
          <button
            className="icon-button shelf-step"
            onClick={() => step(-1)}
            disabled={edges.start}
            aria-label="Scroll daily artists back"
            title="Back"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            className="icon-button shelf-step"
            onClick={() => step(1)}
            disabled={edges.end}
            aria-label="Scroll daily artists on"
            title="More"
          >
            <ChevronLeftIcon size={16} className="flip" />
          </button>
          <button className="back shelf-all" onClick={onSeeAll}>
            See all <ChevronLeftIcon size={16} className="flip" />
          </button>
        </div>
      </div>
      <div className="shelf-track" ref={track}>
        {artists.map((artist) => (
          <button key={artist.id} className="shelf-card shelf-artist" onClick={() => navigate(`/artist/${artist.id}`)}>
            <span className="album-art">
              {artist.coverArt ? (
                <Cover className="artist-avatar" src={coverUrl(artist.coverArt, 300)} />
              ) : (
                <span className="artist-avatar empty" aria-hidden>
                  {artist.name.slice(0, 1)}
                </span>
              )}
            </span>
            <span className="album-name">{artist.name}</span>
            <span className="album-artist">
              <span className="album-artist-name">
                {artist.albumCount} {artist.albumCount === 1 ? 'album' : 'albums'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function HomeView() {
  const [rows, setRows] = useState<HomeRows | null>(cache?.rows ?? null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    getHome().then(
      (payload) => {
        cache = { at: Date.now(), rows: payload };
        setRows(payload);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, []);

  useEffect(() => {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      setRows(cache.rows);
      return;
    }
    load();
  }, [load]);

  // a phone that comes back to the app should not be reading yesterday's shelves
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && (!cache || Date.now() - cache.at > 5000)) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [load]);

  const rowsOf = (key: AlbumShelfKey) => rows?.[key] ?? [];
  const artistsOf = () => rows?.dailyArtists ?? [];
  const empty = rows && SHELVES.every((shelf) => rowsOf(shelf.key).length === 0) && artistsOf().length === 0;

  return (
    <div className="view">
      <header className="view-head">
        <h1 className="display">Home</h1>
      </header>

      {!rows && !failed && <p className="empty">Reading the library…</p>}
      {failed && <p className="empty">Could not reach Navidrome just now.</p>}
      {empty && <p className="empty">Nothing to show yet. Play an album and it will turn up here.</p>}

      {rows &&
        SHELVES.map((shelf) => (
          <Fragment key={shelf.key}>
            <Shelf title={shelf.title} albums={rowsOf(shelf.key)} sort={shelf.sort} />
            {/* the playlists played here sit right under the albums that played */}
            {shelf.key === 'lastPlayed' && <PlaylistShelf playlists={rows.lastPlayedPlaylists ?? []} />}
          </Fragment>
        ))}

      {rows && <ArtistShelf artists={artistsOf()} onSeeAll={() => navigate('/library/artists')} />}
    </div>
  );
}
