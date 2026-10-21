import { useEffect, useRef, useState } from 'react';
import { NowBar } from './MiniPlayer';
import {
  AlbumsIcon,
  ArtistIcon,
  ChevronLeftIcon,
  HomeIcon,
  CloseIcon,
  LibraryIcon,
  LogOutIcon,
  PlaylistIcon,
  QueueIcon,
  RefreshIcon,
  SearchIcon,
  SettingsIcon,
} from './icons';
import { TrackActions, TrackActionsProvider } from './TrackActions';
import { LoginView } from './views/LoginView';
import { type Session, getSession, signOut, type Song } from './api';
import { type LibraryTab, goBack, navigate, useRoute } from './router';
import { type Settings, applySettings, loadSettings } from './settings';
import { hydratePrefs } from './prefs';
import { type Theme, applyTheme, loadTheme } from './theme';
import { useCounts } from './useCounts';
import { useJukebox } from './useJukebox';
import { AlbumView } from './views/AlbumView';
import { ArtistView } from './views/ArtistView';
import { SearchView } from './views/SearchView';
import { SettingsView } from './views/SettingsView';
import { FavoritesView } from './views/FavoritesView';
import { Library } from './views/Library';
import { PlayerView } from './views/PlayerView';
import { PlaylistView } from './views/PlaylistView';
import { HomeView } from './views/HomeView';
import { QueueView } from './views/QueueView';

const RAIL = [
  { path: '/home', label: 'Home', icon: HomeIcon },
  { path: '/search', label: 'Search', icon: SearchIcon },
  { path: '/library/albums', label: 'Albums', icon: AlbumsIcon },
  { path: '/library/artists', label: 'Artists', icon: ArtistIcon },
  { path: '/library/playlists', label: 'Playlists', icon: PlaylistIcon },
  { path: '/queue', label: 'Queue', icon: QueueIcon },
];

const TABS = [
  { path: '/home', label: 'Home', icon: HomeIcon },
  { path: '/library/albums', label: 'Library', icon: LibraryIcon },
  { path: '/search', label: 'Search', icon: SearchIcon },
  { path: '/queue', label: 'Queue', icon: QueueIcon },
];

/**
 * Pull down from the top of a list to re-fetch state. The refresh button in the
 * corner was doing this silently, so the gesture replaces it.
 */
function usePullToRefresh(onRefresh: () => void, enabled: boolean) {
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  // the caller's callback is a new closure on every render (the poll re-renders every
  // second), and re-subscribing that often threw away a pull already in progress
  const latest = useRef(onRefresh);

  useEffect(() => {
    latest.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || !window.matchMedia('(max-width: 899px)').matches) return;
    let startY: number | null = null;
    let armed = false;

    const reset = () => {
      startY = null;
      armed = false;
      pullRef.current = 0;
      setPull(0);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || window.scrollY > 0) return;
      if (document.querySelector('.sheet-layer, .player')) return;
      startY = event.clientY;
      armed = false;
    };

    const onMove = (event: PointerEvent) => {
      if (startY === null) return;
      const dy = event.clientY - startY;
      if (dy <= 0 || window.scrollY > 0) return reset();
      armed = dy > 14;
      if (!armed) return;
      pullRef.current = Math.min(1, dy / 90);
      setPull(pullRef.current);
    };

    const onUp = () => {
      if (armed && pullRef.current > 0.75) latest.current();
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
  }, [enabled]);

  return pull;
}

/**
 * iOS-style back: a left-edge drag on a phone. Nothing moves while dragging (that
 * would fight the sticky bar and the fixed deck), so a chevron fades in as a cue.
 */
function useEdgeSwipeBack(fence: React.RefObject<HTMLDivElement | null>, onBack: () => void) {
  // the cue is written straight to the DOM: re-rendering the whole app on every
  // pointermove made the phone stutter mid-gesture
  const cue = (value: number) => {
    if (fence.current) fence.current.style.opacity = String(value);
  };

  useEffect(() => {
    let origin: { x: number; y: number } | null = null;
    let travel = 0;

    const reset = () => {
      origin = null;
      travel = 0;
      cue(0);
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
      if (dx <= 0) return cue(0);
      travel = dx;
      cue(Math.min(1, dx / 110));
    };

    const onUp = (event: PointerEvent) => {
      const commit = Boolean(origin) && travel > 90;
      reset();
      if (!commit) return;
      // the finger lifting over a card would otherwise be delivered to the new
      // route as a click, and iOS repaints the grid while the gesture is still
      // settling — that repaint is the flash
      event.preventDefault();
      const swallow = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
      };
      document.addEventListener('click', swallow, true);
      window.setTimeout(() => document.removeEventListener('click', swallow, true), 400);
      // let the gesture finish dispatching before the DOM swaps under it
      window.setTimeout(onBack, 50);
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
}

export default function App() {
  const { route } = useRoute();
  const [session, setSession] = useState<Session | null>(null);
  const edgeCue = useRef<HTMLDivElement | null>(null);
  const pull = usePullToRefresh(() => void jbox.refresh(), route.name !== 'player');
  useEdgeSwipeBack(edgeCue, () => goBack(route.name === 'playlist' ? '/playlists' : '/library'));
  // nothing polls until we know whether a password is needed
  const paused = !session || (session.required && !session.authenticated);
  const jbox = useJukebox({ paused });
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  // the account's preferences arrive before the shell paints, so nothing flashes
  // a device-local value that the account overrides
  const [prefsReady, setPrefsReady] = useState(false);
  // per device on purpose: a theme is about the screen you are holding
  const [theme, setTheme] = useState<Theme>(loadTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let alive = true;
    void hydratePrefs().then(() => {
      if (!alive) return;
      setSettings(loadSettings());
      setPrefsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
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
    onDone?: () => void;
  } | null>(null);
  const isPlayer = route.name === 'player';
  // the full-screen player owns the screen, lyrics mode included: nothing but the
  // stage content changes there
  const chrome = !isPlayer;

  // leaving the player route should not leave lyrics mode armed for next time
  useEffect(() => {
    if (route.name !== 'player' && lyricsOpen) setLyricsOpen(false);
  }, [route.name, lyricsOpen]);
  // the badge counts what is still ahead of the current track, not the whole queue
  const count = Math.max(jbox.entries.length - (jbox.status?.currentIndex ?? -1) - 1, 0);
  // the deck follows the track that is playing, not the tracks still ahead: on the
  // last one there are none ahead, and the whole player used to vanish
  // a queue that ran out is not a track to keep showing: with repeat off the bar
  // used to sit there on the finished last song until something else was played
  const hasTrack = jbox.entries.length > 0 && (jbox.status?.currentIndex ?? -1) >= 0 && !jbox.ended;

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  const routeKey = route.name === 'album' || route.name === 'artist' ? `${route.name}:${route.id}` : route.name;

  const section =
    route.name === 'home'
      ? 'home'
      : route.name === 'playlist'
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
              : route.name === 'search'
                ? 'search'
                : route.name === 'settings'
                  ? 'settings'
                  : 'albums';

  const isLibrary = route.name === 'library';
  // the library's tab has to survive while its view is hidden
  const libraryTab = useRef<LibraryTab>('albums');
  if (isLibrary) libraryTab.current = route.tab;

  const view = (() => {
    switch (route.name) {
      case 'library':
        return null;
      case 'album':
        return <AlbumView id={route.id} jbox={jbox} />;
      case 'artist':
        return <ArtistView key={route.id} id={route.id} jbox={jbox} />;
      case 'favorites':
        return <FavoritesView jbox={jbox} />;
      case 'home':
        return <HomeView />;
      case 'playlist':
        return <PlaylistView id={route.id} jbox={jbox} />;
      case 'queue':
        return <QueueView jbox={jbox} />;
      case 'search':
        return <SearchView jbox={jbox} />;
      case 'settings':
        return <SettingsView settings={settings} onChange={setSettings} theme={theme} onTheme={setTheme} />;
      case 'player':
        return (
          <PlayerView
            lyricLeadMs={settings.lyricLeadMs}
            lyricsLookup={settings.lyricsLookup}
            jbox={jbox}
            lyricsOpen={lyricsOpen}
            onLyricsOpenChange={setLyricsOpen}
          />
        );
      default:
        return null;
    }
  })();

  const librarySlot = (
    // kept in the layout but invisible: display:none makes iOS throw away the
    // decoded covers, so coming back re-decodes them and the grid flashes
    <div className={`library-slot ${isLibrary ? '' : 'is-hidden'}`} aria-hidden={!isLibrary}>
      <Library tab={libraryTab.current} />
    </div>
  );

  // the shell must not mount before we know whether a password is needed, or its
  // first fetches race the session check and 401
  if (!session || !prefsReady) {
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
      className={`shell ${isPlayer ? 'shell-player' : ''} ${hasTrack && !isPlayer ? 'has-deck' : ''}`}
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
          {RAIL.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              aria-current={section === path.split('/').pop() ? 'page' : undefined}
              onClick={() => navigate(path)}
              title={label}
            >
              <Icon size={18} />
              {label}
              {path === '/library/albums' && counts?.albums != null && (
                <span className="count-pill">{counts.albums}</span>
              )}
              {path === '/library/artists' && counts && counts.artists.length > 0 && (
                <span className="count-pill">{counts.artists.length}</span>
              )}
              {path === '/library/playlists' && counts?.playlists != null && (
                <span className="count-pill">{counts.playlists}</span>
              )}
              {path === '/queue' && count > 0 && (
                <span className="badge" key={count}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <button
            className="rail-settings"
            aria-current={section === 'settings' ? 'page' : undefined}
            onClick={() => navigate('/settings')}
            title="Settings"
          >
            <SettingsIcon size={18} />
            Settings
          </button>

          {session?.required && (
            <button
              className="rail-signout"
              onClick={() => void signOut().then(() => setSession({ required: true, authenticated: false }))}
            >
              Sign out
            </button>
          )}
        </div>

      </aside>

      <div className="page">
        {!isPlayer && (
          <header className="topbar">
            <button className="wordmark small" onClick={() => navigate('/library/albums')}>
              <span className="wordmark-stack">
                <span className="wordmark-latin">juuku</span>
                <span className="wordmark-kana" lang="ja">
                  ジューク
                </span>
              </span>
              <span className={`led ${jbox.error ? 'bad' : jbox.health?.ok ? 'good' : ''}`} />
            </button>
            <button
              className="icon-button settings-open"
              onClick={() => (route.name === 'settings' ? goBack() : navigate('/settings'))}
              aria-label={route.name === 'settings' ? 'Close settings' : 'Settings'}
            >
              {route.name === 'settings' ? <CloseIcon size={18} /> : <SettingsIcon size={18} />}
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
          </header>
        )}

        <main className="content" key={routeKey}>
          {librarySlot}
      {isLibrary ? null : view}
        </main>

        {hasTrack && (
          <NowBar
            jbox={jbox}
            expanded={isPlayer}
            lyricsLookup={settings.lyricsLookup}
            onOpen={undefined}
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

      <div className="edge-back" ref={edgeCue} aria-hidden="true">
        <ChevronLeftIcon size={18} />
      </div>

      {pull > 0 && (
        <div className="pull-hint" style={{ opacity: pull }} aria-hidden="true">
          <RefreshIcon size={16} style={{ transform: `rotate(${pull * 180}deg)` }} />
        </div>
      )}

      {jbox.toast && <output className="toast">{jbox.toast}</output>}
      {jbox.error && (
        <div className="error-toast" role="alert">
          <span>{jbox.error}</span>
          <button className="error-toast-dismiss" onClick={jbox.dismissError} aria-label="Dismiss this message">
            ×
          </button>
        </div>
      )}

      {trackActions && (
        <TrackActions target={trackActions} onClose={() => setTrackActions(null)} jbox={jbox} />
      )}
    </div>
    </TrackActionsProvider>
  );
}
