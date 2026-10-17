import { useCallback, useEffect, useState } from 'react';
import { type Playlist, type Song, addToPlaylist, createPlaylist, getPlaylists, removeFromPlaylist } from './api';

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setPlaylists((await getPlaylists()).playlists);
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

  return { playlists, loading, refresh, create, addSongs, removeSong };
}
