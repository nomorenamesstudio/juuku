export type Theme = 'mocha' | 'modern' | 'geek';

export const THEMES: { id: Theme; name: string; note: string }[] = [
  { id: 'mocha', name: 'Mocha', note: 'Serif, amber, cover glow' },
  { id: 'modern', name: 'Modern', note: 'Sans, turquoise, flat' },
  { id: 'geek', name: 'Geek', note: 'Monospace terminal' },
];

const KEY = 'juuku.theme';

let current: Theme = 'mocha';
const listeners = new Set<() => void>();

export const getTheme = () => current;

/** Components that draw differently per theme (the pixel icons) subscribe here. */
export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'modern' || stored === 'geek' || stored === 'mocha') return stored;
  } catch {
    // private mode: mocha it is
  }
  return 'mocha';
}

export function applyTheme(theme: Theme) {
  // one attribute; every colour, face and corner radius reads from it in CSS
  current = theme;
  document.documentElement.dataset.theme = theme;
  for (const listener of listeners) listener();
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private mode: the session keeps it
  }
  applyTheme(theme);
}
