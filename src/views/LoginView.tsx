import { useState } from 'react';
import { signIn } from '../api';

/** Shown only when the server has JUUKU_PASSWORD set and the cookie is missing. */
export function LoginView({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(password);
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="view login-view">
      <header className="view-head">
        <p className="wordmark-stack login-mark">
          <span className="wordmark-latin">juuku</span>
          <span className="wordmark-kana" lang="ja">
            ジューク
          </span>
        </p>
        <h1 className="display">Sign in</h1>
        <p className="fineprint">This jukebox asks for its password before it takes orders.</p>
      </header>

      <form className="login-form" onSubmit={submit}>
        <div className="login-field">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            aria-label="Password"
            autoComplete="current-password"
            autoFocus
          />
        </div>
        <button className="primary" type="submit" disabled={busy || !password}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
