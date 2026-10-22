import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Playlist, type Song, coverUrl, deletePlaylist, getPlaylist } from '../api';
import { Cover } from '../Cover';
import { formatTotal } from '../format';
import { ChevronLeftIcon, CloseIcon, KebabIcon, PlayIcon, PlusIcon } from '../icons';
import { navigate, useBack } from '../router';
import { SongRow } from '../rows';
import { useTrackActions } from '../TrackActions';
import type { Jukebox } from '../useJukebox';

/** what the sheet behind the kebab is showing, if anything */
type Sheet = 'none' | 'menu' | 'confirm';

export function PlaylistView({ id, jbox }: { id: string; jbox: Jukebox }) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [error, setError] = useState<string | null>(null);
  const back = useBack('/playlists');
  const openActions = useTrackActions();
  const [sheet, setSheet] = useState<Sheet>('none');
  const [deleting, setDeleting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  // the track sheet removes songs through its own hook, so this view has to ask for
  // the list again — it used to keep showing a row that was already gone
  const [reloadKey, setReloadKey] = useState(0);

  // one sheet at a time: the kebab's menu, then the delete confirmation on top of it
  useEffect(() => {
    if (sheet === 'none') return;
    sheetRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) setSheet('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet, deleting]);

  const remove = async () => {
    setDeleting(true);
    try {
      await deletePlaylist(id);
      jbox.notify(`Deleted ${playlist?.name ?? 'playlist'}`);
      navigate('/playlists');
    } catch (err) {
      jbox.notify((err as Error).message);
      setDeleting(false);
      setSheet('none');
    }
  };

  useEffect(() => {
    setPlaylist(null);
    getPlaylist(id).then(
      (payload) => {
        setPlaylist(payload.playlist);
        setSongs(payload.songs);
      },
      (err: Error) => setError(err.message),
    );
  }, [id, reloadKey]);

  if (error) return <p className="empty">{error}</p>;

  return (
    <div className="view">
      <button className="back" onClick={back.go}>
        <ChevronLeftIcon size={18} /> {back.label}
      </button>

      <header className="album-head">
        <div className="album-art large">
          {playlist?.coverArt ? <Cover src={coverUrl(playlist.coverArt, 600)} /> : null}
        </div>
        <div className="album-meta">
          <h1 className="display">{playlist?.name ?? '…'}</h1>
          <p className="album-facts">
            <span className="fact">
              {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
            </span>
            {songs.length > 0 ? (
              <>
                {' · '}
                <span className="fact">
                  {formatTotal(songs.reduce((sum, song) => sum + (song.duration || 0), 0))}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </header>

      <div className="actions album-actions">
        <button className="primary" disabled={jbox.busy || songs.length === 0} onClick={() => jbox.playNow(songs, id)}>
          <PlayIcon size={18} /> Play all
        </button>
        <button
          className="secondary"
          disabled={jbox.busy || songs.length === 0}
          onClick={() => jbox.addToQueue(songs, `Queued ${playlist?.name}`)}
        >
          <PlusIcon size={18} /> Add to queue
        </button>
        {!playlist?.protected && (
          <button
            className="secondary kebab"
            disabled={!playlist}
            onClick={() => setSheet('menu')}
            aria-label="More playlist actions"
            title="More"
          >
            <KebabIcon size={18} />
          </button>
        )}
      </div>

      {playlist?.protected && songs.length > 0 && (
        <p className="fineprint">Filled by the heart on any track or in the player, so this one can’t be deleted.</p>
      )}

      {songs.length === 0 ? (
        <p className="empty">
          Empty for now. Use the ⋯ menu on any track to add it here.
        </p>
      ) : (
        <ul className="rows">
          {songs.map((song, index) => (
            <SongRow
              key={`${song.id}-${index}`}
              song={song}
              active={jbox.current?.id === song.id}
              playing={jbox.status?.playing}
              onPlay={() => jbox.playFrom(songs, index, id)}
              onMenu={() => openActions([song], { playlistId: id, onDone: () => setReloadKey((n) => n + 1) })}
            />
          ))}
        </ul>
      )}

      {sheet !== 'none' &&
        createPortal(
          <div className="sheet-layer" onClick={() => !deleting && setSheet('none')} role="presentation">
            <div
              ref={sheetRef}
              tabIndex={-1}
              className={sheet === 'confirm' ? 'sheet confirm' : 'sheet'}
              role={sheet === 'confirm' ? 'alertdialog' : 'dialog'}
              aria-modal="true"
              aria-label={sheet === 'confirm' ? 'Delete playlist' : 'Playlist actions'}
              onClick={(event) => event.stopPropagation()}
            >
              {sheet === 'menu' ? (
                <>
                  <header className="sheet-head">
                    <div>
                      <p className="sheet-eyebrow">{playlist?.name}</p>
                      <p className="sheet-sub">
                        {songs.length} {songs.length === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                    <button className="icon-button" onClick={() => setSheet('none')} aria-label="Close">
                      <CloseIcon size={18} />
                    </button>
                  </header>
                  <div className="sheet-list">
                    <button className="sheet-action danger" onClick={() => setSheet('confirm')}>
                      Delete playlist
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <header className="sheet-head">
                    <div>
                      <p className="sheet-eyebrow">Delete “{playlist?.name}”?</p>
                      <p className="sheet-sub">The playlist goes, the tracks stay in your library.</p>
                    </div>
                  </header>
                  <div className="confirm-actions">
                    <button className="secondary" onClick={() => setSheet('none')} disabled={deleting}>
                      Cancel
                    </button>
                    <button className="danger-solid" onClick={() => void remove()} disabled={deleting}>
                      {deleting ? 'Deleting…' : 'Delete playlist'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
