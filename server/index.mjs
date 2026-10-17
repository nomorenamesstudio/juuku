import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ApiError, binary, call, serverInfo } from './subsonic.mjs';

try {
  process.loadEnvFile('.env');
} catch {
  // .env is optional; defaults below target the local sandbox.
}

const PORT = Number(process.env.PORT ?? 3101);

// Everything jukeboxControl accepts, minus `get`/`status` (those are reads).
const WRITE_ACTIONS = new Set(['set', 'start', 'stop', 'skip', 'add', 'clear', 'remove', 'shuffle', 'setGain']);

const app = express();
app.use(express.json());

const wrap = (handler) => (req, res) => handler(req, res).catch((err) => fail(res, err));

function fail(res, err) {
  const status = err instanceof ApiError ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message ?? 'Unknown error' });
}

function badRequest(message) {
  return new ApiError(400, message);
}

const song = (entry) => ({
  id: entry.id,
  title: entry.title,
  artist: entry.artist,
  album: entry.album,
  albumId: entry.albumId,
  duration: entry.duration,
  track: entry.track,
  coverArt: entry.coverArt,
  year: entry.year,
});

const playlistOf = (response) => ({
  status: {
    currentIndex: response.currentIndex,
    playing: response.playing,
    gain: response.gain,
    position: response.position,
  },
  entries: (response.entry ?? []).map(song),
});

const statusOf = (response) => ({
  currentIndex: response.jukeboxStatus.currentIndex,
  playing: response.jukeboxStatus.playing,
  gain: response.jukeboxStatus.gain,
  position: response.jukeboxStatus.position,
});

/** Connection + capability probe. Fails loudly when jukebox mode is off. */
app.get('/api/health', wrap(async (_req, res) => {
  const [ping, jukebox] = await Promise.all([
    call('ping'),
    call('jukeboxControl', { action: 'status' }).then(statusOf, (err) => ({ error: err.message })),
  ]);
  res.json({
    ok: jukebox.error === undefined,
    ...serverInfo(),
    navidrome: (ping.serverVersion ?? ping.version).split(' ')[0],
    apiVersion: ping.version,
    jukebox,
  });
}));

/** Single poll target: queue + playback state in one round trip. */
app.get('/api/state', wrap(async (_req, res) => {
  const response = await call('jukeboxControl', { action: 'get' });
  res.json(playlistOf(response.jukeboxPlaylist));
}));

app.post('/api/control', wrap(async (req, res) => {
  const { action, index, offset, ids, gain } = req.body ?? {};
  if (!WRITE_ACTIONS.has(action)) throw badRequest(`action must be one of ${[...WRITE_ACTIONS].join(', ')}`);

  const params = { action };
  if (action === 'skip' || action === 'remove') params.index = index;
  if (action === 'skip' && offset !== undefined) params.offset = offset;
  if ((action === 'set' || action === 'add') && !Array.isArray(ids)) throw badRequest('ids must be an array');
  if (action === 'setGain' && !(gain >= 0 && gain <= 1)) throw badRequest('gain must be between 0 and 1');

  const response = await call('jukeboxControl', { action, index: params.index, offset: params.offset, id: ids, gain }, { repeat: ['id'] });
  res.json(statusOf(response));
}));

app.get('/api/search', wrap(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ songs: [] });
  const response = await call('search3', { query: q, songCount: 40, albumCount: 0, artistCount: 0 });
  res.json({ songs: (response.searchResult3?.song ?? []).map(song) });
}));

app.get('/api/albums', wrap(async (req, res) => {
  const type = String(req.query.type ?? 'newest');
  const response = await call('getAlbumList2', { type, size: Number(req.query.size ?? 30), offset: 0 });
  res.json({
    albums: (response.albumList2?.album ?? []).map((album) => ({
      id: album.id,
      name: album.name,
      artist: album.artist,
      year: album.year,
      songCount: album.songCount,
      coverArt: album.coverArt,
    })),
  });
}));

app.get('/api/albums/:id', wrap(async (req, res) => {
  const response = await call('getAlbum', { id: req.params.id });
  res.json({
    album: { id: response.album.id, name: response.album.name, artist: response.album.artist },
    songs: (response.album.song ?? []).map(song),
  });
}));

app.get('/api/cover/:id', wrap(async (req, res) => {
  const { body, contentType } = await binary('getCoverArt', { id: req.params.id, size: Number(req.query.size ?? 300) });
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.end(body);
}));

const dist = join(process.cwd(), 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, '127.0.0.1', () => {
  const { url, user } = serverInfo();
  console.log(`juicebox api on http://127.0.0.1:${PORT} -> ${url} as ${user}`);
});
