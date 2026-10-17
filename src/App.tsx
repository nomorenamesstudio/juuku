import { useEffect, useState } from 'react';
import { NowBar } from './MiniPlayer';
import { ArtistIcon, ChevronLeftIcon, HeartIcon, LibraryIcon, LogOutIcon, PlaylistIcon, QueueIcon, RefreshIcon } from './icons';
import { TrackActions, TrackActionsProvider } from './TrackActions';
import { LoginView } from './views/LoginView';
import { type Session, getSession, signOut, type Song } from './api';
import { goBack, navigate, useRoute } from './router';
import { useCounts } from './useCounts';
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

/**
 * iOS-style back: a left-edge drag on a phone. Nothing moves while dragging (that
 * would fight the sticky bar and the fixed deck), so a chevron fades in as a cue.
 */
function useEdgeSwipeBack(onBack: () => void) {
  const [pull, setPull] = useState(0);

  useEffect(() => {
    let origin: { x: number; y: number } | null = null;
    let travel = 0;

    const reset = () => {
      origin = null;
      travel = 0;
      setPull(0);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || event.clientX > 26) return;
      if (!window.matchMedia('(max-width: 899px)').matches) return;
      if (document.querySelector('.sheet-layer')) return;
      origin = { x: event.clientX, y: event.clientY };
      travel = 0;
    };

    const onMove = (event: PointerEvent) => {
      if (!origin) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      // a vertical drag belongs to the player's pull-to-dismiss, not to us
      if (Math.abs(dy) > 50 && travel === 0) return reset();
      if (dx <= 0) return setPull(0);
      travel = dx;
      setPull(Math.min(1, dx / 110));
    };

    const onUp = () => {
      if (origin && travel > 90) onBack();
      reset();
    };

    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', reset, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', reset, true);
    };
  }, [onBack]);

  return pull;
}

export default function App() {
  const { route } = useRoute();
  const [session, setSession] = useState<Session | null>(null);
  const edgePull = useEdgeSwipeBack(() => goBack(route.name === 'playlist' ? '/playlists' : '/library'));
  // nothing polls until we know whether a password is needed
  const paused = !session || (session.required && !session.authenticated);
  const jbox = useJukebox({ paused });
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const counts = useCounts({ paused });

  const loadSession = () => getSession().then(setSession, () => setSession({ required: false, authenticated: true }));

  useEffect(() => {
    void loadSession();
    // a 401 anywhere means the cookie expired mid-use
    const onUnauthorized = () => setSession({ required: true, authenticated: false });
    window.addEventListener('juuku:unauthorized', onUnauthorized);
    return () => window.removeEventListener('juuku:unauthorized', onUnauthorized);
  }, []);
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

  // the shell must not mount before we know whether a password is needed, or its
  // first fetches race the session check and 401
  if (!session) {
    return (
      <main className="boot">
        <span className="wordmark-stack">
          <span className="wordmark-latin">juuku</span>
          <span className="wordmark-kana" lang="ja">
            ジューク
          </span>
        </span>
      </main>
    );
  }

  if (session.required && !session.authenticated) {
    return <LoginView onSignedIn={() => void loadSession()} />;
  }

  return (
    <TrackActionsProvider value={(songs, options) => setTrackActions({ songs, ...options })}>
    <div
      className={`shell ${isPlayer ? 'shell-player' : ''} ${lyricsOpen ? 'lyrics-open' : ''} ${
        count > 0 && !isPlayer ? 'has-deck' : ''
      }`}
    >
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
                  {path === '/library/albums' && counts?.albums != null && (
                    <span className="count-pill">{counts.albums}</span>
                  )}
                  {path === '/library/artists' && counts && counts.artists.length > 0 && (
                    <span className="count-pill">{counts.artists.length}</span>
                  )}
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
          {session?.required && (
            <button
              className="rail-signout"
              onClick={() => void signOut().then(() => setSession({ required: true, authenticated: false }))}
            >
              Sign out
            </button>
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
            {session?.required && (
              <button
                className="icon-button"
                onClick={() => void signOut().then(() => setSession({ required: true, authenticated: false }))}
                aria-label="Sign out"
              >
                <LogOutIcon size={18} />
              </button>
            )}
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

      {edgePull > 0 && (
        <div className="edge-back" style={{ opacity: edgePull }} aria-hidden="true">
          <ChevronLeftIcon size={18} />
        </div>
      )}

      {jbox.toast && <output className="toast">{jbox.toast}</output>}
      {jbox.error && (
        <div className="error-strip" role="alert">
          {jbox.error}
          <button onClick={jbox.dismissError}>Dismiss</button>
        </div>
      )}

      {trackActions && (
        <TrackActions target={trackActions} onClose={() => setTrackActions(null)} jbox={jbox} />
      )}
    </div>
    </TrackActionsProvider>
  );
}
