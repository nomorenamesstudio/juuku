import { useEffect, useRef, useState } from 'react';

export type Route =
  | { name: 'library' }
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
      return id ? { name: 'album', id } : { name: 'library' };
    case 'artist':
      return id ? { name: 'artist', id } : { name: 'library' };
    case 'favorites':
      return { name: 'favorites' };
    case 'queue':
      return { name: 'queue' };
    case 'player':
      return { name: 'player' };
    default:
      return { name: 'library' };
  }
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
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
