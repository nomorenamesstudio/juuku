export type Theme = 'classic' | 'modern' | 'geek';

export const THEMES: { id: Theme; name: string; note: string }[] = [
  { id: 'classic', name: 'Classic', note: 'Serif, amber, cover glow' },
  { id: 'modern', name: 'Modern', note: 'Sans, green, flat' },
  { id: 'geek', name: 'Geek', note: 'Monospace terminal' },
];

const KEY = 'juuku.theme';

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'modern' || stored === 'geek' || stored === 'classic') return stored;
  } catch {
    // private mode: classic it is
  }
  return 'classic';
}

export function applyTheme(theme: Theme) {
  // one attribute; every colour, face and corner radius reads from it in CSS
  document.documentElement.dataset.theme = theme;
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private mode: the session keeps it
  }
  applyTheme(theme);
}
