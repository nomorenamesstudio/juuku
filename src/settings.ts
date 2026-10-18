export type LyricFont = 'sans' | 'serif';

export interface Settings {
  /** how early a lyric line lights up, in ms */
  lyricLeadMs: number;
  lyricFont: LyricFont;
}

const KEY = 'juuku.settings';

/** per device: timing depends on the network path, the font on taste */
export const DEFAULT_SETTINGS: Settings = { lyricLeadMs: 400, lyricFont: 'sans' };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      lyricLeadMs: Number.isFinite(parsed.lyricLeadMs) ? Math.min(1500, Math.max(0, Number(parsed.lyricLeadMs))) : DEFAULT_SETTINGS.lyricLeadMs,
      lyricFont: parsed.lyricFont === 'serif' ? 'serif' : 'sans',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function applySettings(settings: Settings) {
  document.documentElement.dataset.lyricFont = settings.lyricFont;
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // private mode or a full quota: the session still uses the value it holds
  }
  applySettings(settings);
}
