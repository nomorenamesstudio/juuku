import { useEffect, useRef, useState } from 'react';
import { createPlaylist } from './api';
import { CloseIcon } from './icons';
import { navigate } from './router';
import { useVisualViewport } from './useVisualViewport';

/**
 * Naming a new playlist: the library header opens this, and the ⋯ menu on a track
 * has its own copy for the "create and add these songs" case.
 */
export function NewPlaylistSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  useVisualViewport(layer);

  useEffect(() => {
    // the field carries autoFocus, so the dialog must not take focus from it
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const { playlist } = await createPlaylist(trimmed);
      onClose();
      navigate(`/playlist/${playlist.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="sheet-layer" ref={layer} onClick={onClose} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-playlist-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <div>
            <p className="sheet-eyebrow" id="new-playlist-title">
              New playlist
            </p>
            <p className="sheet-sub">Name it, then add tracks from any track's ⋯ menu.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </header>
        <form
          className="sheet-new"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Playlist name"
            aria-label="Playlist name"
          />
          <button className="primary" type="submit" disabled={busy || !name.trim()}>
            Create
          </button>
        </form>
        {error && <p className="sheet-note">{error}</p>}
      </div>
    </div>
  );
}
