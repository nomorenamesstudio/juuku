import { useEffect, useState } from 'react';

export type LibraryTab = 'albums' | 'artists' | 'playlists';

export type Route =
  | { name: 'home' }
  | { name: 'library'; tab: LibraryTab }
  | { name: 'album'; id: string }
  | { name: 'artist'; id: string }
  | { name: 'favorites' }
  | { name: 'playlists' }
  | { name: 'playlist'; id: string }
  | { name: 'queue' }
  | { name: 'player' }
  | { name: 'search' }
  | { name: 'settings' };

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, id] = path.split('/');
  switch (head) {
    case 'album':
      return id ? { name: 'album', id } : { name: 'library', tab: 'albums' };
    case 'artist':
      return id ? { name: 'artist', id } : { name: 'library', tab: 'artists' };
    case 'library':
      return { name: 'library', tab: id === 'artists' ? 'artists' : id === 'playlists' ? 'playlists' : 'albums' };
    case 'favorites':
      return { name: 'favorites' };
    // playlists live under the library now; the old link still lands there
    case 'playlists':
      return { name: 'library', tab: 'playlists' };
    case 'home':
      return { name: 'home' };
    case 'playlist':
      return id ? { name: 'playlist', id } : { name: 'library', tab: 'playlists' };
    case 'queue':
      return { name: 'queue' };
    case 'player':
      return { name: 'player' };
    case 'search':
      return { name: 'search' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'home' };
  }
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

// how many in-app hash changes happened; 0 means the current route was entered
// directly (deep link), where history.back() would leave the app
let depth = 0;
// The browser's history stack cannot be read, so keep our own: push on a forward
// navigation, pop when the new route is the one below the top (i.e. we went back).
// Module level so every view reads the same answer, not a copy made at mount.
const same = (a: Route, b: Route) => a.name === b.name && (a as { id?: string }).id === (b as { id?: string }).id;

let here: Route = parse(window.location.hash);
let stack: Route[] = [here];
let cameFrom: Route = here;

window.addEventListener('hashchange', () => {
  depth += 1;
  const next = parse(window.location.hash);
  if (stack.length > 1 && same(stack[stack.length - 2], next)) stack.pop();
  else stack.push(next);
  here = next;
  cameFrom = stack[stack.length - 2] ?? next;
});

/** Close a view: go back if this route was reached inside the app, else fall back. */
export function goBack(fallback = '/library') {
  if (depth > 0) window.history.back();
  else navigate(fallback);
}

const LABELS: Record<Route['name'], string> = {
  home: 'Home',
  library: 'Library',
  album: 'Album',
  artist: 'Artist',
  favorites: 'Favorites',
  playlists: 'Playlists',
  playlist: 'Playlist',
  queue: 'Queue',
  player: 'Player',
  search: 'Search',
  settings: 'Settings',
};

/** Back, labelled with where it actually goes: the previous view inside the app. */
export function useBack(fallback = '/library') {
  // subscribe so the label follows navigation
  useRoute();
  const target = depth > 0 ? cameFrom : parse(fallback);
  return { label: LABELS[target.name], go: () => goBack(fallback) };
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return { route };
}
