export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumId?: string;
  duration: number;
  track?: number;
  coverArt?: string;
  year?: number;
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

export interface Album {
  id: string;
  name: string;
  artist: string;
  year?: number;
  songCount: number;
  coverArt?: string;
}

export interface Health {
  ok: boolean;
  url: string;
  user: string;
  navidrome: string;
  jukebox: PlaybackStatus | { error: string };
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
export const search = (q: string) => request<{ songs: Song[] }>(`/api/search?q=${encodeURIComponent(q)}`);
export const getAlbums = (type = 'newest') => request<{ albums: Album[] }>(`/api/albums?type=${type}`);
export const getAlbumSongs = (id: string) => request<{ songs: Song[] }>(`/api/albums/${id}`);

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

export const coverUrl = (id: string | undefined, size = 300) =>
  id ? `/api/cover/${encodeURIComponent(id)}?size=${size}` : undefined;
