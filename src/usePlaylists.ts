import { useCallback, useEffect, useState } from 'react';
import { type Playlist, type Song, addToPlaylist, createPlaylist, getPlaylists, removeFromPlaylist } from './api';

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPlaylists((await getPlaylists()).playlists);
      setError(null);
    } catch (err) {
      // a first read that fails is not an unhandled rejection, and "no playlists"
      // is the wrong thing to show for it
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (name: string, songs: Song[] = []) => {
      const { playlist } = await createPlaylist(name, songs.map((song) => song.id));
      await refresh();
      return playlist;
    },
    [refresh],
  );

  const addSongs = useCallback(
    async (playlistId: string, songs: Song[]) => {
      await addToPlaylist(playlistId, songs.map((song) => song.id));
      await refresh();
    },
    [refresh],
  );

  const removeSong = useCallback(
    async (playlistId: string, songId: string) => {
      await removeFromPlaylist(playlistId, songId);
      await refresh();
    },
    [refresh],
  );

  return { playlists, loading, error, refresh, create, addSongs, removeSong };
}
