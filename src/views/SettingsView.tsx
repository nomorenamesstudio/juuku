import { useEffect, useState } from 'react';
import { type Health, type PlayerStatus, getHealth, getPlayerStatus, restartPlayers } from '../api';
import { GithubIcon } from '../icons';
import { type Settings, saveSettings } from '../settings';
import { THEMES, type Theme, saveTheme } from '../theme';

export function SettingsView({
  settings,
  onChange,
  theme,
  onTheme,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  theme: Theme;
  onTheme: (next: Theme) => void;
}) {
  const [health, setHealth] = useState<Health | null>(null);
  const [players, setPlayers] = useState<PlayerStatus | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [restartNote, setRestartNote] = useState<string | null>(null);
  // sockets that exist but refuse us, so "0 running" is not the whole story
  const blocked = players?.blocked ?? 0;

  useEffect(() => {
    getHealth().then(setHealth, () => setHealth(null));
    getPlayerStatus().then(setPlayers, () => setPlayers(null));
  }, []);

  const restart = async () => {
    setRestarting(true);
    setRestartNote(null);
    try {
      const result = await restartPlayers();
      setRestartNote(
        `Killed ${result.quit} leftover ${result.quit === 1 ? 'player' : 'players'}${
          result.restored ? ', queue restored' : ''
        }.${result.blocked ? ` ${result.blocked} socket${result.blocked === 1 ? '' : 's'} could not be opened.` : ''}`,
      );
    } catch (err) {
      setRestartNote((err as Error).message);
    } finally {
      setRestarting(false);
      getPlayerStatus().then(setPlayers, () => {});
    }
  };

  const update = (next: Partial<Settings>) => {
    const merged = { ...settings, ...next };
    saveSettings(merged);
    onChange(merged);
  };

  return (
    <div className="view settings-view">
      <header className="view-head">
        <h1 className="display">Settings</h1>
        <p className="fineprint">
          Lyrics settings are saved on this server for your account; the theme stays on this device
        </p>
      </header>

      <section className="settings-block" aria-labelledby="settings-theme">
        <h2 id="settings-theme">Theme</h2>
        <p className="fineprint">This device only</p>
        <div className="theme-choices" role="radiogroup" aria-label="Theme">
          {THEMES.map((option) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={theme === option.id}
              className={`theme-choice ${theme === option.id ? 'is-on' : ''}`}
              onClick={() => {
                saveTheme(option.id);
                onTheme(option.id);
              }}
            >
              <span className={`theme-swatch theme-swatch-${option.id}`} aria-hidden />
              <span className="theme-text">
                <span className="row-title">{option.name}</span>
                <span className="row-sub">{option.note}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-block" aria-labelledby="settings-lyrics">
        <h2 id="settings-lyrics">Lyrics</h2>

        <div className="settings-row">
          <span className="settings-label">
            Timing lead
            <span className="fineprint">
              How early a line lights up. Raise it if your connection lags; the highlight should land as the
              singing starts.
            </span>
          </span>
        </div>

        <div className="settings-slider-row">
          <input
            className="settings-slider"
            type="range"
            min={0}
            max={2000}
            step={50}
            value={settings.lyricLeadMs}
            onChange={(event) => update({ lyricLeadMs: Number(event.target.value) })}
            aria-label="Lyric timing lead in milliseconds"
            aria-valuetext={`${settings.lyricLeadMs} milliseconds`}
            style={{ ['--progress' as string]: `${(settings.lyricLeadMs / 2000) * 100}%` }}
          />
          <output className="settings-value">{settings.lyricLeadMs} ms</output>
        </div>

        <div className="settings-row">
          <span className="settings-label">Look up lyrics online</span>
          <div className="segmented compact" role="tablist" aria-label="Online lyrics lookup">
            {([false, true] as const).map((on) => (
              <button
                key={String(on)}
                role="tab"
                aria-selected={settings.lyricsLookup === on}
                onClick={() => update({ lyricsLookup: on })}
              >
                {on ? 'On' : 'Off'}
              </button>
            ))}
          </div>
        </div>

        <p className="fineprint settings-note">
          Off, the app shows only the lyrics inside the file. On, it asks LRCLIB when a file has none — and LRCLIB
          guesses: remixes and instrumentals often come back with another recording's words.
        </p>

      </section>

      <section className="settings-block" aria-labelledby="settings-server">
        <h2 id="settings-server">Connected to</h2>
        <dl className="settings-facts">
          <dt>Navidrome</dt>
          <dd>{health?.url ?? '…'}</dd>
          <dt>Server version</dt>
          <dd>{health?.navidrome ?? '…'}</dd>
          <dt>Signed in as</dt>
          <dd>{health?.user ?? '…'}</dd>
          <dt>Players</dt>
          <dd>
            {players
              ? players.shared
                ? `${players.players} running${blocked ? `, ${blocked} not reachable` : ''}`
                : 'not shared'
              : '…'}
          </dd>
          <dt>Jukebox</dt>
          <dd>{health ? ('enabled' in health.jukebox && health.jukebox.enabled ? 'enabled' : 'off') : '…'}</dd>
        </dl>
        {players?.shared && (
          <button className="secondary" onClick={() => void restart()} disabled={restarting}>
            {restarting ? 'Restarting…' : 'Restart playback'}
          </button>
        )}
        {players?.shared && blocked > 0 && (
          <p className="fineprint settings-note">
            {blocked === 1 ? 'A player socket is' : `${blocked} player sockets are`} visible but not
            readable, so it cannot be quit from here: mpv creates its socket 0600 under its own uid, and this container
            has to run as that uid (usually root) to open it. See SETUP.md.
          </p>
        )}
        {restartNote && <p className="fineprint settings-note">{restartNote}</p>}
      </section>

      <section className="settings-block" aria-labelledby="settings-about">
        <h2 id="settings-about">About</h2>
        <dl className="settings-facts">
          <dt>Juuku</dt>
          <dd>v{__APP_VERSION__}</dd>
        </dl>
        <p className="fineprint settings-credit">
          Made with ♥ by{' '}
          <a href="https://nomorenames.studio" target="_blank" rel="noreferrer noopener">
            No More Names Studio
          </a>
        </p>
        <a className="settings-link" href="https://github.com/nomorenamesstudio/juuku" target="_blank" rel="noreferrer noopener">
          <GithubIcon size={16} /> GitHub repo
        </a>
      </section>
    </div>
  );
}
