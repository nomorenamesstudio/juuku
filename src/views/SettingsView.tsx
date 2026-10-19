import { useEffect, useState } from 'react';
import { type Health, type PlayerStatus, getHealth, getPlayerStatus, restartPlayers } from '../api';
import { GithubIcon } from '../icons';
import { type Settings, saveSettings } from '../settings';

export function SettingsView({ settings, onChange }: { settings: Settings; onChange: (next: Settings) => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [players, setPlayers] = useState<PlayerStatus | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [restartNote, setRestartNote] = useState<string | null>(null);

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
        }.`,
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
          Saved on this server for your account — every device that points here shares them
        </p>
      </header>

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

        <div className="settings-row">
          <span className="settings-label">Font</span>
          <div className="segmented compact" role="tablist" aria-label="Lyrics font">
            {(['sans', 'serif'] as const).map((font) => (
              <button
                key={font}
                role="tab"
                aria-selected={settings.lyricFont === font}
                className={`font-choice font-${font}`}
                onClick={() => update({ lyricFont: font })}
              >
                {font === 'sans' ? 'Sans' : 'Serif'}
              </button>
            ))}
          </div>
        </div>
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
            {players ? (players.shared ? `${players.players} running` : 'not shared') : '…'}
          </dd>
          <dt>Jukebox</dt>
          <dd>{health ? ('enabled' in health.jukebox && health.jukebox.enabled ? 'enabled' : 'off') : '…'}</dd>
        </dl>
        {players?.shared && (
          <button className="secondary" onClick={() => void restart()} disabled={restarting}>
            {restarting ? 'Restarting…' : 'Restart playback'}
          </button>
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
