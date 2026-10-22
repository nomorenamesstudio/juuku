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
  /** Navidrome's per-disc titles (OpenSubsonic `discTitles`), when the tags have them */
  discTitles?: { disc: number; title: string }[];
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
  /** the Favorites playlist owned by the heart button */
  protected?: boolean;
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
  // a body that is not JSON means the path is not ours (a stale server behind an
  // older build answers index.html); swallowing it turned that into `{}` and a
  // crash far from the cause
  const text = await res.text();
  let body: { error?: string } & Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${res.status} ${res.statusText}: expected JSON from ${path}`);
    }
  }
  if (!res.ok) {
    // an expired session surfaces as a 401 on whatever the app calls next
    if (res.status === 401) window.dispatchEvent(new Event('juuku:unauthorized'));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return body as T;
}

export interface Session {
  required: boolean;
  authenticated: boolean;
}

export const getSession = () => request<Session>('api/session');

export const signIn = (password: string) =>
  request<{ ok: boolean }>('api/login', { method: 'POST', body: JSON.stringify({ password }) });

export const signOut = () => request<{ ok: boolean }>('api/logout', { method: 'POST' });

export const getHealth = () => request<Health>('api/health');

export interface PlayerStatus {
  shared: boolean;
  players: number;
  /** sockets that exist but refuse us — mpv's 0600 under another uid */
  blocked?: number;
}

export const getPlayerStatus = () => request<PlayerStatus>('api/player/status');

export const restartPlayers = () =>
  request<{ found: number; quit: number; players: number; blocked: number; restored: boolean }>(
    'api/player/restart',
    { method: 'POST' },
  );
export const getState = () => request<State>('api/state');
export const getLyrics = (songId: string, lookup = false) =>
  request<Lyrics>(`api/lyrics/${songId}${lookup ? '?lookup=1' : ''}`);

export const search = (q: string) =>
  request<{ songs: Song[]; albums: Album[]; artists: Artist[] }>(`api/search?q=${encodeURIComponent(q)}`);

export type AlbumSort = 'alphabeticalByName' | 'alphabeticalByArtist' | 'newest' | 'recent' | 'byYear' | 'daily';

export interface HomeRows {
  lastPlayed: Album[];
  lastAdded: Album[];
  newestRelease: Album[];
  dailyPicks: Album[];
  dailyArtists: Artist[];
  /** playlists started from the app, newest first */
  lastPlayedPlaylists: Playlist[];
}

export async function getHome(): Promise<HomeRows> {
  const payload = await request<Partial<HomeRows>>(`api/home?day=${new Date().toLocaleDateString('sv')}`);
  const keys: (keyof HomeRows)[] = ['lastPlayed', 'lastAdded', 'newestRelease', 'dailyPicks', 'dailyArtists', 'lastPlayedPlaylists'];
  if (!keys.every((key) => Array.isArray(payload?.[key]))) throw new Error('the server has no home rows');
  return payload as HomeRows;
}

export const getAlbums = (offset = 0, size = 30, type: AlbumSort = 'newest') =>
  request<{ albums: Album[]; hasMore: boolean }>(
    `api/albums?type=${type}&size=${size}&offset=${offset}&day=${new Date().toLocaleDateString('sv')}`,
  );

export const getAlbum = (id: string) => request<{ album: Album; songs: Song[] }>(`api/albums/${id}`);
export const getCounts = () => request<{ albums: number | null; playlists: number | null }>('api/counts');

export const getArtists = () => request<{ artists: Artist[] }>('api/artists');
export const getArtist = (id: string) => request<{ artist: Artist; albums: Album[] }>(`api/artists/${id}`);
export const getArtistSongs = (id: string) => request<{ songs: Song[] }>(`api/artists/${id}/songs`);

export const getFavorites = () => request<Favorites>('api/favorites');
export const addFavorite = (ids: string[]) =>
  request<Favorites>('api/favorites', { method: 'POST', body: JSON.stringify({ ids }) });
export const removeFavorite = (id: string) =>
  request<Favorites>(`api/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' });

export type ControlAction = 'set' | 'start' | 'stop' | 'skip' | 'add' | 'clear' | 'remove' | 'shuffle' | 'setGain';

export interface ControlBody {
  action: ControlAction;
  index?: number;
  offset?: number;
  ids?: string[];
  gain?: number;
}

export const control = (body: ControlBody) =>
  request<PlaybackStatus>('api/control', { method: 'POST', body: JSON.stringify(body) });

/** Replace the queue with these songs and start playing at `index`. */
export const playNow = (ids: string[], index = 0, playlistId?: string) =>
  request<PlaybackStatus>('api/play', { method: 'POST', body: JSON.stringify({ ids, index, playlistId }) });

/** Insert right after the current track instead of at the end of the queue. */
export const playNext = (ids: string[]) =>
  request<PlaybackStatus>('api/queue/next', { method: 'POST', body: JSON.stringify({ ids }) });

export const getPlaylists = () => request<{ playlists: Playlist[] }>('api/playlists');
export const getPlaylist = (id: string) => request<{ playlist: Playlist; songs: Song[] }>(`api/playlists/${id}`);
export const createPlaylist = (name: string, ids: string[] = []) =>
  request<{ playlist: Playlist }>('api/playlists', { method: 'POST', body: JSON.stringify({ name, ids }) });
export const addToPlaylist = (id: string, ids: string[]) =>
  request<{ playlist: Playlist; songs: Song[] }>(`api/playlists/${id}/songs`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
export const deletePlaylist = (id: string) =>
  request<{ deleted: string; name?: string }>(`api/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const removeFromPlaylist = (id: string, songId: string) =>
  request<{ playlist: Playlist; songs: Song[] }>(`api/playlists/${id}/songs/${encodeURIComponent(songId)}`, {
    method: 'DELETE',
  });

/**
 * Bumped when the proxy used to hand out non-images (0.8.8 and earlier): every cover
 * URL a browser cached in that window is a JSON error, and a new URL is the only way
 * to make it fetch again without asking anyone to clear their cache.
 */
const COVER_VERSION = 'v=2';

export const coverUrl = (id: string | undefined, size = 400) =>
  id ? `api/cover/${encodeURIComponent(id)}?size=${size}&${COVER_VERSION}` : undefined;
