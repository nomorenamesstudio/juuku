export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  duration: number;
  track?: number;
  disc?: number;
  coverArt?: string;
  year?: number;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  artistId?: string;
  year?: number;
  songCount: number;
  duration?: number;
  coverArt?: string;
}

export interface Artist {
  id: string;
  name: string;
  albumCount: number;
  coverArt?: string;
}

export interface PlaybackStatus {
  currentIndex: number;
  playing: boolean;
  gain: number;
  position: number;
}

export interface State {
  status: PlaybackStatus;
  entries: Song[];
}

export interface Health {
  ok: boolean;
  url: string;
  user: string;
  navidrome: string;
  jukebox: PlaybackStatus | { error: string };
}

export interface Lyrics {
  source: 'navidrome' | 'lrclib' | 'none';
  synced: boolean;
  lines: { time?: number; text: string }[];
}

export interface Playlist {
  id: string;
  name: string;
  songCount: number;
  duration?: number;
  coverArt?: string;
  comment?: string;
  owner?: string;
  created?: string;
  changed?: string;
}

export interface Favorites {
  playlistId: string | null;
  songs: Song[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body as T;
}

export const getHealth = () => request<Health>('/api/health');
export const getState = () => request<State>('/api/state');
export const getLyrics = (songId: string) => request<Lyrics>(`/api/lyrics/${songId}`);

export const search = (q: string) =>
  request<{ songs: Song[]; albums: Album[]; artists: Artist[] }>(`/api/search?q=${encodeURIComponent(q)}`);

export const getAlbums = (offset = 0, size = 30, type = 'newest') =>
  request<{ albums: Album[]; hasMore: boolean }>(`/api/albums?type=${type}&size=${size}&offset=${offset}`);

export const getAlbum = (id: string) => request<{ album: Album; songs: Song[] }>(`/api/albums/${id}`);
export const getArtists = () => request<{ artists: Artist[] }>('/api/artists');
export const getArtist = (id: string) => request<{ artist: Artist; albums: Album[] }>(`/api/artists/${id}`);

export const getFavorites = () => request<Favorites>('/api/favorites');
export const addFavorite = (ids: string[]) =>
  request<Favorites>('/api/favorites', { method: 'POST', body: JSON.stringify({ ids }) });
export const removeFavorite = (id: string) =>
  request<Favorites>(`/api/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' });

export type ControlAction = 'set' | 'start' | 'stop' | 'skip' | 'add' | 'clear' | 'remove' | 'shuffle' | 'setGain';

export interface ControlBody {
  action: ControlAction;
  index?: number;
  offset?: number;
  ids?: string[];
  gain?: number;
}

export const control = (body: ControlBody) =>
  request<PlaybackStatus>('/api/control', { method: 'POST', body: JSON.stringify(body) });

/** Replace the queue with these songs and start playing at `index`. */
export const playNow = (ids: string[], index = 0) =>
  request<PlaybackStatus>('/api/play', { method: 'POST', body: JSON.stringify({ ids, index }) });

/** Insert right after the current track instead of at the end of the queue. */
export const playNext = (ids: string[]) =>
  request<PlaybackStatus>('/api/queue/next', { method: 'POST', body: JSON.stringify({ ids }) });

export const getPlaylists = () => request<{ playlists: Playlist[] }>('/api/playlists');
export const getPlaylist = (id: string) => request<{ playlist: Playlist; songs: Song[] }>(`/api/playlists/${id}`);
export const createPlaylist = (name: string, ids: string[] = []) =>
  request<{ playlist: Playlist }>('/api/playlists', { method: 'POST', body: JSON.stringify({ name, ids }) });
export const addToPlaylist = (id: string, ids: string[]) =>
  request<{ playlist: Playlist; songs: Song[] }>(`/api/playlists/${id}/songs`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
export const removeFromPlaylist = (id: string, songId: string) =>
  request<{ playlist: Playlist; songs: Song[] }>(`/api/playlists/${id}/songs/${encodeURIComponent(songId)}`, {
    method: 'DELETE',
  });

export const coverUrl = (id: string | undefined, size = 400) =>
  id ? `/api/cover/${encodeURIComponent(id)}?size=${size}` : undefined;
