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

/**
 * Where each view was left. A view that scrolls (the album grid, a queue) came back
 * at the top before, which loses your place when you open a record and step back.
 */
const scrollMemory = new Map<string, number>();
/**
 * The offset has to be sampled *while* the old view is still on screen: by the time
 * hashchange fires React has already swapped the view, the page is shorter and the
 * browser has clamped scrollY to whatever fits — which is how 1400 became 377.
 */
let trackedHash = window.location.hash;
let trackedY = window.scrollY;
window.addEventListener(
  'scroll',
  () => {
    // a scroll caused by the layout collapsing on the way out must not count
    if (window.location.hash === trackedHash) trackedY = window.scrollY;
  },
  { passive: true },
);
// the browser restores its own idea of the offset on history.back, which fought the
// per-view memory below and landed between the two
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const scrollKey = (hash: string) => hash.replace(/^#/, '') || '/';
let here: Route = parse(window.location.hash);
let stack: Route[] = [here];
let cameFrom: Route = here;

window.addEventListener('hashchange', (event) => {
  scrollMemory.set(scrollKey(new URL(event.oldURL).hash), trackedY);
  trackedHash = window.location.hash;
  trackedY = window.scrollY;
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
      const next = parse(window.location.hash);
      setRoute(next);
      // the player owns the screen, so it never carries an offset; every other view
      // returns to where it was left, or starts at the top on a first visit
      const remembered = next.name === 'player' ? undefined : scrollMemory.get(scrollKey(window.location.hash));
      // the view is mounted hidden, so its height arrives a frame or two after the
      // route does: keep asking for the old offset until the page is tall enough
      let tries = 0;
      const restore = () => {
        window.scrollTo({ top: remembered ?? 0 });
        tries += 1;
        if (remembered && tries < 6 && Math.abs(window.scrollY - remembered) > 4) {
          window.setTimeout(() => requestAnimationFrame(restore), 80);
        }
      };
      requestAnimationFrame(restore);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return { route };
}
