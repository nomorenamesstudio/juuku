import { useEffect, useRef, useState } from 'react';

export type Route =
  | { name: 'library'; tab: 'albums' | 'artists' }
  | { name: 'album'; id: string }
  | { name: 'artist'; id: string }
  | { name: 'favorites' }
  | { name: 'queue' }
  | { name: 'player' };

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head, id] = path.split('/');
  switch (head) {
    case 'album':
      return id ? { name: 'album', id } : { name: 'library', tab: 'albums' };
    case 'artist':
      return id ? { name: 'artist', id } : { name: 'library', tab: 'artists' };
    case 'library':
      return { name: 'library', tab: id === 'artists' ? 'artists' : 'albums' };
    case 'favorites':
      return { name: 'favorites' };
    case 'queue':
      return { name: 'queue' };
    case 'player':
      return { name: 'player' };
    default:
      return { name: 'library', tab: 'albums' };
  }
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

// how many in-app hash changes happened; 0 means the current route was entered
// directly (deep link), where history.back() would leave the app
let depth = 0;
window.addEventListener('hashchange', () => {
  depth += 1;
});

/** Close a view: go back if this route was reached inside the app, else fall back. */
export function goBack(fallback = '/library') {
  if (depth > 0) window.history.back();
  else navigate(fallback);
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  const previous = useRef<Route>(route);

  useEffect(() => {
    const onHashChange = () => {
      const next = parse(window.location.hash);
      setRoute((current) => {
        if (current.name !== 'player') previous.current = current;
        return next;
      });
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return { route, previous: previous.current };
}
