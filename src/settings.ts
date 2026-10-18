export type LyricFont = 'sans' | 'serif';

export interface Settings {
  /** how early a lyric line lights up, in ms */
  lyricLeadMs: number;
  lyricFont: LyricFont;
  /** ask LRCLIB when the file carries no lyrics; off, because it guesses */
  lyricsLookup: boolean;
}

import { readPref, writePref } from './prefs';

const KEY = 'juuku.settings';

/** per device: timing depends on the network path, the font on taste */
export const DEFAULT_SETTINGS: Settings = { lyricLeadMs: 400, lyricFont: 'sans', lyricsLookup: false };

export function loadSettings(): Settings {
  try {
    const parsed = readPref<Partial<Settings> | null>(KEY, null);
    if (!parsed) return DEFAULT_SETTINGS;
    return {
      lyricLeadMs: Number.isFinite(parsed.lyricLeadMs) ? Math.min(1500, Math.max(0, Number(parsed.lyricLeadMs))) : DEFAULT_SETTINGS.lyricLeadMs,
      lyricFont: parsed.lyricFont === 'serif' ? 'serif' : 'sans',
      lyricsLookup: parsed.lyricsLookup === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function applySettings(settings: Settings) {
  document.documentElement.dataset.lyricFont = settings.lyricFont;
}

export function saveSettings(settings: Settings) {
  writePref(KEY, settings);
  applySettings(settings);
}
