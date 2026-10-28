import { useEffect, useRef, useState } from 'react';
import { type Album, type Artist, type Playlist, type Song, coverUrl, getPlaylists, search } from '../api';
import { formatTotal } from '../format';
import { Cover } from '../Cover';
import { CloseIcon, SearchIcon } from '../icons';
import { readPref, writePref } from '../prefs';
import { navigate } from '../router';
import { SongRow } from '../rows';
import type { Jukebox } from '../useJukebox';

interface Results {
  songs: Song[];
  albums: Album[];
  artists: Artist[];
}

interface Recent {
  kind: 'album' | 'artist';
  id: string;
  name: string;
  sub: string;
  coverArt?: string;
}

const RECENT_KEY = 'juuku.search.recent';
const RECENT_MAX = 10;

function readRecent(): Recent[] {
  const raw = readPref<Recent[]>(RECENT_KEY, []);
  return Array.isArray(raw)
    ? raw
        .filter((item) => item && typeof item.id === 'string' && (item.kind === 'album' || item.kind === 'artist'))
        .slice(0, RECENT_MAX)
    : [];
}

function writeRecent(entries: Recent[]) {
  writePref(RECENT_KEY, entries);
}

const coverOf = (coverArt?: string) => (coverArt ? coverUrl(coverArt, 96) : undefined);

export function SearchView({ jbox }: { jbox: Jukebox }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [recent, setRecent] = useState<Recent[]>(readRecent);
  // Subsonic's search has no playlists; they are one cheap call, filtered here
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPlaylists().then(
      (payload) => setPlaylists(payload.playlists),
      () => setPlaylists([]),
    );
  }, []);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setResults(null);
      return;
    }
    const timer = window.setTimeout(() => {
      search(text).then(
        (payload) => {
          // an artist with no albums has nothing to open
          setResults({ ...payload, artists: payload.artists.filter((artist) => (artist.albumCount ?? 0) > 0) });
        },
        () => setResults(null),
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  /**
   * Recent holds what was opened, not what was typed: a query saved on every
   * keystroke's results filled the list with "Ap", "Aphe", "Aphex"…
   */
  const remember = (entry: Recent) => {
    setRecent((previous) => {
      const next = [entry, ...previous.filter((item) => !(item.kind === entry.kind && item.id === entry.id))].slice(
        0,
        RECENT_MAX,
      );
      writeRecent(next);
      return next;
    });
  };

  /**
   * With the keyboard up, iOS shrinks the visual viewport while the page keeps
   * scrolling under the fixed deck and tab bar, so the list looked like it ran on
   * past the footer. Scrolling the list, or tapping anywhere but the field, drops
   * the keyboard and gives the page its height back.
   */
  useEffect(() => {
    const dismiss = () => {
      if (document.activeElement === input.current) input.current?.blur();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.search-field')) dismiss();
    };
    window.addEventListener('scroll', dismiss, { passive: true });
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('scroll', dismiss);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  const openAlbum = (album: Album) => {
    remember({ kind: 'album', id: album.id, name: album.name, sub: `Album · ${album.artist}`, coverArt: album.coverArt });
    navigate(`/album/${album.id}`);
  };

  const openArtist = (artist: Artist) => {
    remember({ kind: 'artist', id: artist.id, name: artist.name, sub: 'Artist', coverArt: artist.coverArt });
    navigate(`/artist/${artist.id}`);
  };

  const forget = (entry: Recent) => {
    setRecent((previous) => {
      const next = previous.filter((item) => !(item.kind === entry.kind && item.id === entry.id));
      writeRecent(next);
      return next;
    });
  };

  const clearRecent = () => {
    writeRecent([]);
    setRecent([]);
  };

  const text = query.trim().toLowerCase();
  const matchingPlaylists = text ? playlists.filter((playlist) => playlist.name.toLowerCase().includes(text)) : [];

  const nothing =
    results &&
    results.songs.length === 0 &&
    results.albums.length === 0 &&
    results.artists.length === 0 &&
    matchingPlaylists.length === 0;

  return (
    <div className="view">
      <header className="view-head head-search">
        <h1 className="display">Search</h1>
        <div className="search-field">
          <SearchIcon size={18} />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Songs, albums, artists, playlists"
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
      </header>

      {results ? (
        <div className="search-results">
          {nothing && <p className="empty">Nothing matches “{query.trim()}”.</p>}

          {results.artists.length > 0 && (
            <section>
              <h2 className="section-label">Artists</h2>
              <ul className="plain-list">
                {results.artists.map((artist) => (
                  <li key={artist.id}>
                    <button className="link-row with-art" onClick={() => openArtist(artist)}>
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
                    <button className="link-row with-art" onClick={() => openAlbum(album)}>
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

          {matchingPlaylists.length > 0 && (
            <section>
              <h2 className="section-label">Playlists</h2>
              <ul className="plain-list">
                {matchingPlaylists.map((playlist) => (
                  <li key={playlist.id}>
                    <button className="link-row with-art" onClick={() => navigate(`/playlist/${playlist.id}`)}>
                      {playlist.coverArt ? (
                        <Cover src={coverUrl(playlist.coverArt, 96)} />
                      ) : (
                        <span className="playlist-art-fallback" aria-hidden />
                      )}
                      <span className="link-text">
                        <span className="row-title">{playlist.name}</span>
                        <span className="row-sub">
                          {playlist.songCount} {playlist.songCount === 1 ? 'track' : 'tracks'} ·{' '}
                          {formatTotal(playlist.duration ?? 0)}
                        </span>
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
                {results.songs.map((song, index) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    // the same columns as every other track list, and the number tells
                    // you where you are when you play a few to hear what they are
                    number={index + 1}
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
      ) : recent.length > 0 ? (
        <section>
          <div className="section-head">
            <h2 className="section-label">Recent</h2>
            <button className="inline-link" onClick={clearRecent}>
              Clear
            </button>
          </div>
          <ul className="plain-list">
            {recent.map((entry) => (
              <li key={`${entry.kind}-${entry.id}`} className="history-row">
                <button
                  className="link-row with-art history-run"
                  onClick={() => navigate(entry.kind === 'album' ? `/album/${entry.id}` : `/artist/${entry.id}`)}
                >
                  {entry.coverArt ? (
                    <Cover src={coverOf(entry.coverArt)!} />
                  ) : (
                    <span className="playlist-art-fallback" aria-hidden />
                  )}
                  <span className="link-text">
                    <span className="row-title">{entry.name}</span>
                    <span className="row-sub">{entry.sub}</span>
                  </span>
                </button>
                <button
                  className="row-icon"
                  onClick={() => forget(entry)}
                  aria-label={`Remove ${entry.name} from recent`}
                >
                  <CloseIcon size={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="empty">Search songs, albums, artists and playlists. What you open lands here.</p>
      )}
    </div>
  );
}
