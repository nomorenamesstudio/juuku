import { NowBar } from './MiniPlayer';
import { HeartIcon, LibraryIcon, QueueIcon } from './icons';
import { navigate, useRoute } from './router';
import { useJukebox } from './useJukebox';
import { AlbumView } from './views/AlbumView';
import { ArtistView } from './views/ArtistView';
import { FavoritesView } from './views/FavoritesView';
import { Library } from './views/Library';
import { PlayerView } from './views/PlayerView';
import { QueueView } from './views/QueueView';

const NAV = [
  { path: '/library', label: 'Library', icon: LibraryIcon },
  { path: '/favorites', label: 'Favorites', icon: HeartIcon },
  { path: '/queue', label: 'Queue', icon: QueueIcon },
];

export default function App() {
  const jbox = useJukebox();
  const { route } = useRoute();
  const isPlayer = route.name === 'player';

  const activeSection = route.name === 'album' || route.name === 'artist' ? 'library' : route.name;
  const count = jbox.entries.length;

  const view = (() => {
    switch (route.name) {
      case 'album':
        return <AlbumView id={route.id} jbox={jbox} />;
      case 'artist':
        return <ArtistView key={route.id} id={route.id} />;
      case 'favorites':
        return <FavoritesView jbox={jbox} />;
      case 'queue':
        return <QueueView jbox={jbox} />;
      case 'player':
        return <PlayerView jbox={jbox} />;
      default:
        return <Library jbox={jbox} />;
    }
  })();

  return (
    <div className={`shell ${isPlayer ? 'shell-player' : ''}`}>
      <aside className="rail" aria-label="Main">
        <button className="wordmark" onClick={() => navigate('/library')}>
          juicebox
          <span className={`led ${jbox.error ? 'bad' : jbox.health?.ok ? 'good' : ''}`} />
        </button>
        <nav className="rail-nav">
          {NAV.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              aria-current={activeSection === path.slice(1) ? 'page' : undefined}
              onClick={() => navigate(path)}
            >
              <Icon size={19} />
              {label}
              {path === '/queue' && count > 0 && <span className="badge">{count}</span>}
            </button>
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
            <button className="wordmark small" onClick={() => navigate('/library')}>
              juicebox
              <span className={`led ${jbox.error ? 'bad' : jbox.health?.ok ? 'good' : ''}`} />
            </button>
            <button className="icon-button" onClick={jbox.refresh} aria-label="Refresh state">
              ↻
            </button>
          </div>
        )}

        <main className="content">{view}</main>

        {!isPlayer && count > 0 && <NowBar jbox={jbox} />}

        {!isPlayer && (
          <nav className="tabbar" aria-label="Main">
            {NAV.map(({ path, label, icon: Icon }) => (
              <button
                key={path}
                aria-current={activeSection === path.slice(1) ? 'page' : undefined}
                onClick={() => navigate(path)}
              >
                <Icon size={21} />
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
    </div>
  );
}
