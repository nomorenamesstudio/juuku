import { useEffect, useState } from 'react';
import { type Album, type AlbumSort, type Artist, type HomeRows, coverUrl, getHome } from '../api';
import { Cover } from '../Cover';
import { ChevronLeftIcon } from '../icons';
import { writePref } from '../prefs';
import { navigate } from '../router';

export const SORT_KEY = 'juuku.library.sort';

type AlbumShelfKey = 'lastPlayed' | 'lastAdded' | 'newestRelease' | 'dailyPicks';

const SHELVES: { key: AlbumShelfKey; title: string; sort: AlbumSort }[] = [
  { key: 'lastPlayed', title: 'Last played', sort: 'recent' },
  { key: 'lastAdded', title: 'Last added', sort: 'newest' },
  { key: 'newestRelease', title: 'Newest release', sort: 'byYear' },
  { key: 'dailyPicks', title: 'Daily picks', sort: 'daily' },
];

// the shelves are re-read when the screen is opened after a while: Last played only
// moves when something plays, and a cached first load hid that
let cache: { at: number; rows: HomeRows } | null = null;
const CACHE_MS = 30_000;

function Shelf({ title, albums, sort }: { title: string; albums: Album[]; sort: AlbumSort }) {
  if (albums.length === 0) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2 className="section-label">{title}</h2>
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
      <div className="shelf-track">
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

function ArtistShelf({ artists, onSeeAll }: { artists: Artist[]; onSeeAll: () => void }) {
  if (artists.length === 0) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2 className="section-label">Daily artists</h2>
        <button className="back shelf-all" onClick={onSeeAll}>
          See all <ChevronLeftIcon size={16} className="flip" />
        </button>
      </div>
      <div className="shelf-track">
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

  useEffect(() => {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      setRows(cache.rows);
      return;
    }
    let alive = true;
    getHome().then(
      (payload) => {
        cache = { at: Date.now(), rows: payload };
        if (alive) setRows(payload);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

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
          <Shelf key={shelf.key} title={shelf.title} albums={rowsOf(shelf.key)} sort={shelf.sort} />
        ))}

      {rows && <ArtistShelf artists={artistsOf()} onSeeAll={() => navigate('/library/artists')} />}
    </div>
  );
}
