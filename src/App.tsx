import { useEffect, useState } from 'react';
import { NowBar } from './MiniPlayer';
import { ArtistIcon, HeartIcon, LibraryIcon, PlaylistIcon, QueueIcon, RefreshIcon } from './icons';
import { TrackActions, TrackActionsProvider } from './TrackActions';
import type { Song } from './api';
import { navigate, useRoute } from './router';
import { useJukebox } from './useJukebox';
import { AlbumView } from './views/AlbumView';
import { ArtistView } from './views/ArtistView';
import { FavoritesView } from './views/FavoritesView';
import { Library } from './views/Library';
import { PlayerView } from './views/PlayerView';
import { PlaylistView } from './views/PlaylistView';
import { PlaylistsView } from './views/PlaylistsView';
import { QueueView } from './views/QueueView';

const RAIL = [
  { path: '/library/albums', label: 'Albums', group: 'Browse', icon: LibraryIcon },
  { path: '/library/artists', label: 'Artists', group: 'Browse', icon: ArtistIcon },
  { path: '/playlists', label: 'Playlists', group: 'Yours', icon: PlaylistIcon },
  { path: '/favorites', label: 'Favorites', group: 'Yours', icon: HeartIcon },
  { path: '/queue', label: 'Queue', group: 'Yours', icon: QueueIcon },
];

const TABS = [
  { path: '/library/albums', label: 'Library', icon: LibraryIcon },
  { path: '/playlists', label: 'Playlists', icon: PlaylistIcon },
  { path: '/favorites', label: 'Favorites', icon: HeartIcon },
  { path: '/queue', label: 'Queue', icon: QueueIcon },
];

export default function App() {
  const jbox = useJukebox();
  const { route } = useRoute();
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [trackActions, setTrackActions] = useState<{
    songs: Song[];
    playlistId?: string;
    step?: 'playlists';
  } | null>(null);
  const isPlayer = route.name === 'player';
  // on phones the full-screen player owns the screen, except in lyrics mode where
  // the mini player and tabs come back so you can still drive playback
  const chrome = !isPlayer || lyricsOpen;

  // leaving the player route should not leave lyrics mode armed for next time
  useEffect(() => {
    if (route.name !== 'player' && lyricsOpen) setLyricsOpen(false);
  }, [route.name, lyricsOpen]);
  const count = jbox.entries.length;

  const routeKey = route.name === 'album' || route.name === 'artist' ? `${route.name}:${route.id}` : route.name;

  const section =
    route.name === 'playlists' || route.name === 'playlist'
      ? 'playlists'
      : route.name === 'library'
      ? route.tab
      : route.name === 'album'
        ? 'albums'
        : route.name === 'artist'
          ? 'artists'
          : route.name === 'favorites'
            ? 'favorites'
            : route.name === 'queue'
              ? 'queue'
              : 'albums';

  const view = (() => {
    switch (route.name) {
      case 'album':
        return <AlbumView id={route.id} jbox={jbox} />;
      case 'artist':
        return <ArtistView key={route.id} id={route.id} />;
      case 'favorites':
        return <FavoritesView jbox={jbox} />;
      case 'playlists':
        return <PlaylistsView />;
      case 'playlist':
        return <PlaylistView id={route.id} jbox={jbox} />;
      case 'queue':
        return <QueueView jbox={jbox} />;
      case 'player':
        return (
          <PlayerView
            jbox={jbox}
            lyricsOpen={lyricsOpen}
            onLyricsOpenChange={setLyricsOpen}
          />
        );
      default:
        return <Library jbox={jbox} tab={route.tab} />;
    }
  })();

  return (
    <TrackActionsProvider value={(songs, options) => setTrackActions({ songs, ...options })}>
    <div className={`shell ${isPlayer ? 'shell-player' : ''} ${lyricsOpen ? 'lyrics-open' : ''}`}>
      <aside className="rail" aria-label="Main">
        <button className="wordmark" onClick={() => navigate('/library/albums')}>
          <span className="wordmark-stack">
            <span className="wordmark-latin">juuku</span>
            <span className="wordmark-kana" lang="ja">
              ジューク
            </span>
          </span>
          <span className={`led ${jbox.error ? 'bad' : jbox.health?.ok ? 'good' : ''}`} />
        </button>

        <nav className="rail-nav">
          {['Browse', 'Yours'].map((group) => (
            <div key={group} className="rail-group">
              <p>{group}</p>
              {RAIL.filter((item) => item.group === group).map(({ path, label, icon: Icon }) => (
                <button
                  key={path}
                  aria-current={section === path.split('/').pop() ? 'page' : undefined}
                  onClick={() => navigate(path)}
                >
                  <Icon size={18} />
                  {label}
                  {path === '/queue' && count > 0 && (
                    <span className="badge" key={count}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <p className="rail-note">
          {jbox.health ? (
            <>
              {jbox.health.navidrome}
              <br />
              {jbox.health.url.replace(/^https?:\/\//, '')}
            </>
          ) : (
            'connecting…'
          )}
        </p>
      </aside>

      <div className="page">
        {!isPlayer && (
          <div className="topbar">
            <button className="wordmark small" onClick={() => navigate('/library/albums')}>
              <span className="wordmark-stack">
                <span className="wordmark-latin">juuku</span>
                <span className="wordmark-kana" lang="ja">
                  ジューク
                </span>
              </span>
              <span className={`led ${jbox.error ? 'bad' : jbox.health?.ok ? 'good' : ''}`} />
            </button>
            <button className="icon-button" onClick={jbox.refresh} aria-label="Refresh state">
              <RefreshIcon size={18} />
            </button>
          </div>
        )}

        <main className="content" key={routeKey}>
          {view}
        </main>

        {count > 0 && (
          <NowBar
            jbox={jbox}
            expanded={isPlayer}
            onOpen={isPlayer && lyricsOpen ? () => setLyricsOpen(false) : undefined}
          />
        )}

        {chrome && (
          <nav className="tabbar" aria-label="Main">
            {TABS.map(({ path, label, icon: Icon }) => (
              <button
                key={path}
                aria-current={
                  section === path.split('/').pop() || (path === '/library/albums' && section === 'artists')
                    ? 'page'
                    : undefined
                }
                onClick={() => navigate(path)}
              >
                <Icon size={20} />
                {label}
                {path === '/queue' && count > 0 && <span className="badge">{count}</span>}
              </button>
            ))}
          </nav>
        )}
      </div>

      {jbox.toast && <output className="toast">{jbox.toast}</output>}
      {jbox.error && (
        <div className="error-strip" role="alert">
          {jbox.error}
          <button onClick={jbox.refresh}>Retry</button>
        </div>
      )}

      {trackActions && (
        <TrackActions target={trackActions} onClose={() => setTrackActions(null)} jbox={jbox} />
      )}
    </div>
    </TrackActionsProvider>
  );
}
