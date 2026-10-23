import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { type Song, coverUrl } from './api';
import { CloseIcon, PlusIcon } from './icons';
import type { Jukebox } from './useJukebox';
import { usePlaylists } from './usePlaylists';
import { useVisualViewport } from './useVisualViewport';

interface TrackActionsTarget {
  songs: Song[];
  playlistId?: string;
  step?: 'actions' | 'playlists';
  /** the view that opened the sheet wants to refetch after a successful action */
  onDone?: () => void;
}

type OpenActions = (
  songs: Song[],
  options?: { playlistId?: string; step?: 'playlists'; onDone?: () => void },
) => void;

const ActionsContext = createContext<OpenActions>(() => {});
export const useTrackActions = () => useContext(ActionsContext);
export const TrackActionsProvider = ActionsContext.Provider;

/** Bottom sheet with the queue actions for a track, plus the playlist picker. */
export function TrackActions({
  target,
  onClose,
  jbox,
}: {
  target: TrackActionsTarget;
  onClose: () => void;
  jbox: Jukebox;
}) {
  const playlists = usePlaylists();
  const [step, setStep] = useState<'actions' | 'playlists' | 'new'>(target.step ?? 'actions');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  useVisualViewport(layerRef);
  const single = target.songs.length === 1 ? target.songs[0] : null;
  // every song already favorited means the action removes them
  const favorite = target.songs.every((song) => jbox.favoriteIds.has(song.id));
  const title = single ? single.title : `${target.songs.length} tracks`;

  // the sheet takes focus so a keyboard user lands inside it, and Escape closes
  useEffect(() => {
    sheetRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try {
      await action();
      if (message) jbox.notify(message);
      target.onDone?.();
      onClose();
    } catch (err) {
      jbox.notify((err as Error).message);
      setBusy(false);
    }
  };

  const createAndAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await run(async () => {
      await playlists.create(trimmed, target.songs);
    }, `Added to ${trimmed}`);
  };

  return (
    <div className="sheet-layer" ref={layerRef} onClick={onClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <div>
            <p className="sheet-eyebrow" id="sheet-title">
              {step === 'actions' ? title : step === 'new' ? 'New playlist' : 'Add to playlist'}
            </p>
            {step === 'actions' && single ? <p className="sheet-sub">{single.artist}</p> : null}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </header>

        {step === 'actions' && (
          <div className="sheet-list">
            <button className="sheet-action" disabled={busy} onClick={() => run(() => jbox.playNext(target.songs))}>
              Play next
            </button>
            <button className="sheet-action" disabled={busy} onClick={() => run(() => jbox.addToQueue(target.songs))}>
              Add to queue
            </button>
            <button className="sheet-action" onClick={() => setStep('playlists')}>
              Add to playlist
            </button>
            <button
              className="sheet-action"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  for (const song of target.songs) {
                    if (favorite !== jbox.favoriteIds.has(song.id)) await jbox.toggleFavorite(song);
                  }
                }, favorite ? 'Removed from favorites' : 'Added to favorites')
              }
            >
              {favorite ? 'Remove from favorites' : 'Add to favorites'}
            </button>
            {target.playlistId && (
              <button
                className="sheet-action danger"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    for (const song of target.songs) await playlists.removeSong(target.playlistId!, song.id);
                  }, 'Removed from playlist')
                }
              >
                Remove from this playlist
              </button>
            )}
          </div>
        )}

        {step === 'playlists' && (
          <div className="sheet-list">
            {playlists.loading && <p className="sheet-note">Reading playlists…</p>}
            {!playlists.loading && playlists.playlists.length === 0 && (
              <p className="sheet-note">No playlists yet — make the first one.</p>
            )}
            {playlists.playlists.map((playlist) => (
              <button
                key={playlist.id}
                className="sheet-action with-art"
                disabled={busy}
                onClick={() => run(() => playlists.addSongs(playlist.id, target.songs), `Added to ${playlist.name}`)}
              >
                {playlist.coverArt ? <img src={coverUrl(playlist.coverArt, 80)} alt="" /> : <span className="sheet-art" />}
                <span className="sheet-action-text">
                  {playlist.name}
                  <span className="sheet-action-sub">
                    {playlist.songCount} {playlist.songCount === 1 ? 'track' : 'tracks'}
                  </span>
                </span>
              </button>
            ))}
            <button className="sheet-action new" onClick={() => setStep('new')}>
              <PlusIcon size={18} /> New playlist
            </button>
          </div>
        )}

        {step === 'new' && (
          <form
            className="sheet-new"
            onSubmit={(event) => {
              event.preventDefault();
              void createAndAdd();
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
        )}
      </div>
    </div>
  );
}
