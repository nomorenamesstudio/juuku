import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseLrc } from './lyrics.mjs';
import { ApiError, binary, call, serverInfo } from './subsonic.mjs';

try {
  process.loadEnvFile('.env');
} catch {
  // .env is optional; defaults target the local sandbox.
}

const PORT = Number(process.env.PORT ?? 3101);
// HOST=0.0.0.0 serves the built app to the LAN (see .env)
const HOST = process.env.HOST ?? '127.0.0.1';
const FAVORITES_PLAYLIST = 'Favorites';

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

const badRequest = (message) => new ApiError(400, message);

const song = (entry) => ({
  id: entry.id,
  title: entry.title,
  artist: entry.artist,
  artistId: entry.artistId,
  album: entry.album,
  albumId: entry.albumId,
  duration: entry.duration,
  track: entry.track,
  disc: entry.discNumber,
  coverArt: entry.coverArt,
  year: entry.year,
});

const album = (entry) => ({
  id: entry.id,
  name: entry.name,
  artist: entry.artist,
  artistId: entry.artistId,
  year: entry.year,
  songCount: entry.songCount,
  duration: entry.duration,
  coverArt: entry.coverArt,
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

// ---------------------------------------------------------------- connection

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

// ------------------------------------------------------------------- playback

/** Single poll target: queue + playback state in one round trip. */
app.get('/api/state', wrap(async (_req, res) => {
  const response = await call('jukeboxControl', { action: 'get' });
  res.json(playlistOf(response.jukeboxPlaylist));
}));

app.post('/api/control', wrap(async (req, res) => {
  const { action, index, offset, ids, gain } = req.body ?? {};
  if (!WRITE_ACTIONS.has(action)) throw badRequest(`action must be one of ${[...WRITE_ACTIONS].join(', ')}`);

  if ((action === 'skip' || action === 'remove') && !Number.isInteger(index)) {
    throw badRequest(`${action} needs an integer index`);
  }
  if ((action === 'set' || action === 'add') && !Array.isArray(ids)) throw badRequest('ids must be an array');
  if (action === 'setGain' && !(gain >= 0 && gain <= 1)) throw badRequest('gain must be between 0 and 1');

  const response = await call(
    'jukeboxControl',
    { action, index, offset, id: ids, gain },
    { repeat: ['id'] },
  );
  res.json(statusOf(response));
}));

/**
 * Queue the songs right after the current one. `set` resets playback to index 0 and
 * stops it, so the current track is re-skipped (with the position it had reached)
 * and resumed afterwards - otherwise "play next" would jump to the start.
 */
app.post('/api/queue/next', wrap(async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) throw badRequest('ids must be a non-empty array');

  const current = await call('jukeboxControl', { action: 'get' });
  const entries = current.jukeboxPlaylist?.entry ?? [];
  const index = current.jukeboxPlaylist?.currentIndex ?? -1;

  if (entries.length === 0 || index < 0) {
    await call('jukeboxControl', { action: 'set', id: ids }, { repeat: ['id'] });
    await waitForQueue(ids);
    await call('jukeboxControl', { action: 'start' });
  } else {
    const currentId = entries[index].id;
    const wasPlaying = Boolean(current.jukeboxPlaylist.playing);
    const resumeAt = current.jukeboxPlaylist.position ?? 0;
    const next = [
      ...entries.slice(0, index + 1).map((entry) => entry.id),
      ...ids,
      ...entries.slice(index + 1).map((entry) => entry.id),
    ];
    const started = Date.now();
    await call('jukeboxControl', { action: 'set', id: next }, { repeat: ['id'] });
    await waitForQueue(next);
    const target = next.indexOf(currentId);
    const offset = Math.round(resumeAt + (Date.now() - started) / 1000);
    await call('jukeboxControl', { action: 'skip', index: target, offset });
    if (wasPlaying) await call('jukeboxControl', { action: 'start' });
  }

  const response = await call('jukeboxControl', { action: 'status' });
  res.json(statusOf(response));
}));

/**
 * `set` returns before the new queue is live, so a `skip` sent straight after it
 * lands on the old queue and is overwritten. Poll `get` until the queue matches.
 */
async function waitForQueue(ids, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await call('jukeboxControl', { action: 'get' });
    const entries = response.jukeboxPlaylist?.entry ?? [];
    if (entries.length === ids.length && entries.every((entry, i) => entry.id === ids[i])) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

/** Play immediately: replace the queue, jump to a track and start. */
app.post('/api/play', wrap(async (req, res) => {
  const { ids, index = 0 } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) throw badRequest('ids must be a non-empty array');
  if (!Number.isInteger(index) || index < 0 || index >= ids.length) throw badRequest('index must be inside ids');
  await call('jukeboxControl', { action: 'set', id: ids }, { repeat: ['id'] });
  await waitForQueue(ids);
  await call('jukeboxControl', { action: 'skip', index });
  const response = await call('jukeboxControl', { action: 'start' });
  res.json(statusOf(response));
}));

// -------------------------------------------------------------------- library

app.get('/api/search', wrap(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ songs: [], albums: [], artists: [] });
  const response = await call('search3', { query: q, songCount: 40, albumCount: 20, artistCount: 20 });
  const result = response.searchResult3 ?? {};
  res.json({
    songs: (result.song ?? []).map(song),
    albums: (result.album ?? []).map(album),
    artists: (result.artist ?? []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      albumCount: artist.albumCount,
      coverArt: artist.coverArt,
    })),
  });
}));

app.get('/api/albums', wrap(async (req, res) => {
  const type = String(req.query.type ?? 'newest');
  const size = Math.min(Number(req.query.size ?? 30), 100);
  const offset = Number(req.query.offset ?? 0);
  const response = await call('getAlbumList2', { type, size, offset });
  const albums = (response.albumList2?.album ?? []).map(album);
  res.json({ albums, offset, hasMore: albums.length === size });
}));

app.get('/api/albums/:id', wrap(async (req, res) => {
  const response = await call('getAlbum', { id: req.params.id });
  res.json({
    album: album(response.album),
    songs: (response.album.song ?? []).map(song),
  });
}));

app.get('/api/artists', wrap(async (_req, res) => {
  const response = await call('getArtists');
  const artists = (response.artists?.index ?? []).flatMap((index) =>
    (index.artist ?? []).map((artist) => ({
      id: artist.id,
      name: artist.name,
      albumCount: artist.albumCount,
      coverArt: artist.coverArt,
    })),
  );
  res.json({ artists });
}));

app.get('/api/artists/:id', wrap(async (req, res) => {
  const response = await call('getArtist', { id: req.params.id });
  res.json({
    artist: { id: response.artist.id, name: response.artist.name, coverArt: response.artist.coverArt },
    albums: (response.artist.album ?? []).map(album),
  });
}));

app.get('/api/cover/:id', wrap(async (req, res) => {
  const { body, contentType } = await binary('getCoverArt', { id: req.params.id, size: Number(req.query.size ?? 300) });
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.end(body);
}));

// --------------------------------------------------------------------- lyrics

const lyricsCache = new Map();
const LYRIC_TTL = 24 * 60 * 60 * 1000;

async function lyricsFromLrclib(entry) {
  const url = new URL('https://lrclib.net/api/get');
  url.searchParams.set('artist_name', entry.artist ?? '');
  url.searchParams.set('track_name', entry.title ?? '');
  if (entry.album) url.searchParams.set('album_name', entry.album);
  if (entry.duration) url.searchParams.set('duration', String(entry.duration));
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'juicebox/0.1 (local jukebox remote)' },
  });
  if (!res.ok) return null;
  const body = await res.json();
  const synced = body.syncedLyrics ? parseLrc(body.syncedLyrics) : null;
  const plain = body.plainLyrics
    ? body.plainLyrics.split(/\r?\n/).filter((line) => line.trim()).map((text) => ({ text: text.trim() }))
    : null;
  const lines = synced?.length ? synced : plain;
  if (!lines?.length) return null;
  return { source: 'lrclib', synced: Boolean(synced?.length), lines };
}

app.get('/api/lyrics/:id', wrap(async (req, res) => {
  const id = req.params.id;
  const cached = lyricsCache.get(id);
  if (cached && cached.expires > Date.now()) return res.json(cached.value);

  const response = await call('getLyricsBySongId', { id });
  const blocks = response.lyricsList?.structuredLyrics ?? [];
  const block =
    blocks.find((candidate) => candidate.line?.some((line) => line.start !== undefined)) ?? blocks[0];

  let payload = { source: 'none', synced: false, lines: [] };
  if (block?.line?.length) {
    payload = {
      source: 'navidrome',
      synced: block.line.some((line) => line.start !== undefined),
      lines: block.line.map((line) => ({ time: line.start, text: line.value ?? '' })),
    };
  } else {
    // Nothing embedded and no .lrc sidecar: ask LRCLIB once, cache the miss too.
    const songResponse = await call('getSong', { id }).catch(() => null);
    if (songResponse?.song) {
      payload = (await lyricsFromLrclib(songResponse.song).catch(() => null)) ?? payload;
    }
  }

  lyricsCache.set(id, { value: payload, expires: Date.now() + LYRIC_TTL });
  res.json(payload);
}));

// ---------------------------------------------------------------- playlists

const playlistMeta = (entry) => ({
  id: entry.id,
  name: entry.name,
  comment: entry.comment,
  songCount: entry.songCount ?? 0,
  duration: entry.duration,
  owner: entry.owner,
  coverArt: entry.coverArt,
  created: entry.created,
  changed: entry.changed,
});

app.get('/api/playlists', wrap(async (_req, res) => {
  const response = await call('getPlaylists');
  res.json({ playlists: (response.playlists?.playlist ?? []).map(playlistMeta) });
}));

app.get('/api/playlists/:id', wrap(async (req, res) => {
  const response = await call('getPlaylist', { id: req.params.id });
  res.json({
    playlist: playlistMeta(response.playlist),
    songs: (response.playlist.entry ?? []).map(song),
  });
}));

app.post('/api/playlists', wrap(async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) throw badRequest('name is required');
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const response = await call('createPlaylist', { name, songId: ids }, { repeat: ['songId'] });
  res.status(201).json({ playlist: playlistMeta(response.playlist) });
}));

app.post('/api/playlists/:id/songs', wrap(async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) throw badRequest('ids must be a non-empty array');
  await call('updatePlaylist', { playlistId: req.params.id, songIdToAdd: ids }, { repeat: ['songIdToAdd'] });
  const response = await call('getPlaylist', { id: req.params.id });
  res.json({ playlist: playlistMeta(response.playlist), songs: (response.playlist.entry ?? []).map(song) });
}));

app.delete('/api/playlists/:id', wrap(async (req, res) => {
  const response = await call('getPlaylist', { id: req.params.id }).catch(() => null);
  const name = response?.playlist?.name;
  await call('deletePlaylist', { id: req.params.id });
  res.json({ deleted: req.params.id, name });
}));

app.delete('/api/playlists/:id/songs/:songId', wrap(async (req, res) => {
  const response = await call('getPlaylist', { id: req.params.id });
  const songs = (response.playlist.entry ?? []).map(song);
  const index = songs.findIndex((entry) => entry.id === req.params.songId);
  if (index >= 0) {
    await call('updatePlaylist', { playlistId: req.params.id, songIndexToRemove: index });
  }
  const after = await call('getPlaylist', { id: req.params.id });
  res.json({ playlist: playlistMeta(after.playlist), songs: (after.playlist.entry ?? []).map(song) });
}));

// ----------------------------------------------------------------- favourites

async function findFavoritesPlaylist() {
  const response = await call('getPlaylists');
  return (response.playlists?.playlist ?? []).find((entry) => entry.name === FAVORITES_PLAYLIST) ?? null;
}

async function favoritesPayload() {
  const playlist = await findFavoritesPlaylist();
  if (!playlist) return { playlistId: null, songs: [] };
  const response = await call('getPlaylist', { id: playlist.id });
  return { playlistId: playlist.id, songs: (response.playlist.entry ?? []).map(song) };
}

app.get('/api/favorites', wrap(async (_req, res) => {
  res.json(await favoritesPayload());
}));

app.post('/api/favorites', wrap(async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) throw badRequest('ids must be a non-empty array');

  const { playlistId, songs: existing } = await favoritesPayload();
  const known = new Set(existing.map((entry) => entry.id));
  const toAdd = ids.filter((id) => !known.has(id));
  if (toAdd.length === 0) return res.json(await favoritesPayload());

  if (!playlistId) {
    await call('createPlaylist', { name: FAVORITES_PLAYLIST, songId: toAdd }, { repeat: ['songId'] });
  } else {
    await call('updatePlaylist', { playlistId, songIdToAdd: toAdd }, { repeat: ['songIdToAdd'] });
  }
  res.json(await favoritesPayload());
}));

app.delete('/api/favorites/:id', wrap(async (req, res) => {
  const { playlistId, songs } = await favoritesPayload();
  const index = songs.findIndex((entry) => entry.id === req.params.id);
  if (playlistId && index >= 0) {
    await call('updatePlaylist', { playlistId, songIndexToRemove: index });
  }
  res.json(await favoritesPayload());
}));

const dist = join(process.cwd(), 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, HOST, () => {
  const { url, user } = serverInfo();
  console.log(`juicebox api on http://${HOST}:${PORT} -> ${url} as ${user}`);
});
