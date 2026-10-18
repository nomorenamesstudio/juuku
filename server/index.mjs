import express from 'express';
import { existsSync } from 'node:fs';
import { sep } from 'node:path';
import { join } from 'node:path';
import { cleanArtist, cleanTitle, parseLrc, pickCandidate, sameTitle, versionMarked } from './lyrics.mjs';
import { COOKIE, MAX_AGE, createAuth, createThrottle, readCookie } from './auth.mjs';
import { getProfile, putProfile } from './store.mjs';
import { ApiError, binary, call, nativeTotal, serverInfo } from './subsonic.mjs';

try {
  process.loadEnvFile('.env');
} catch {
  // .env is optional; defaults target the local sandbox.
}

const PORT = Number(process.env.PORT ?? 3101);
// HOST=0.0.0.0 serves the built app to the LAN (see .env)
const HOST = process.env.HOST ?? '127.0.0.1';
const FAVORITES_PLAYLIST = 'Favorites';

// Optional shared password (JUUKU_PASSWORD). Unset means no auth, which is the
// LAN-only default documented in SECURITY.md.
const auth = createAuth(process.env.JUUKU_PASSWORD ?? '');
const throttle = createThrottle();
const OPEN_ROUTES = new Set(['/live', '/session', '/login', '/logout']);

// Everything jukeboxControl accepts, minus `get`/`status` (those are reads).
const WRITE_ACTIONS = new Set(['set', 'start', 'stop', 'skip', 'add', 'clear', 'remove', 'shuffle', 'setGain']);

const app = express();
app.use(express.json());

const jukeboxOff = (err) => /jukebox is disabled|admin only|not implemented|\b501\b/i.test(err?.message ?? '');

const JUKEBOX_OFF =
  'Navidrome has jukebox mode off, so it cannot play anything. Set ND_JUKEBOX_ENABLED=true on Navidrome (Jukebox.Enabled in navidrome.toml), restart it, and make sure the machine running Navidrome has mpv and an audio output.';

// Navidrome only lets admins drive the jukebox, whatever the docs suggest.
const JUKEBOX_NOT_ADMIN =
  'Navidrome only lets admin accounts drive the jukebox, so the user Juuku signs in as (NAVIDROME_USER) needs to be an admin: navidrome user edit --username <user> --set-admin.';

const wrap = (handler) => (req, res) => handler(req, res).catch((err) => fail(res, err));

function fail(res, err) {
  const status = err instanceof ApiError ? err.status : 500;
  // the common misconfigurations: say what to do instead of passing a bare code on
  if (/admin only/i.test(err?.message ?? '')) {
    return res.status(501).json({ error: JUKEBOX_NOT_ADMIN });
  }
  if (jukeboxOff(err)) {
    return res.status(501).json({ error: JUKEBOX_OFF });
  }
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

/** Servers without jukebox mode (the main library, for browsing) fail every queue call. */
// Navidrome with jukebox mode off does not even mount the route: it answers 501
// "This endpoint is not implemented", and with AdminOnly it refuses per user.


const emptyState = () => ({
  status: { currentIndex: -1, playing: false, gain: 1, position: 0 },
  entries: [],
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

// behind a reverse proxy req.secure has to see X-Forwarded-Proto
app.set('trust proxy', 1);

const authenticated = (req) => !auth.enabled || auth.valid(readCookie(req.headers.cookie, COOKIE));

app.get('/api/session', (req, res) => {
  res.json({ required: auth.enabled, authenticated: authenticated(req) });
});

app.post('/api/login', wrap(async (req, res) => {
  if (!auth.enabled) return res.json({ ok: true });
  const address = req.ip ?? 'unknown';
  if (throttle.blocked(address)) {
    throw new ApiError(429, 'Too many attempts - wait a few minutes');
  }
  if (!auth.verify(req.body?.password)) {
    throttle.fail(address);
    await new Promise((resolve) => setTimeout(resolve, 400));
    throw new ApiError(401, 'Wrong password');
  }
  throttle.clear(address);
  res.cookie(COOKIE, auth.issue(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: req.secure,
    maxAge: MAX_AGE * 1000,
  });
  res.json({ ok: true });
}));

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

// everything else under /api needs the session when a password is configured
app.use('/api', (req, res, next) => {
  if (OPEN_ROUTES.has(req.path) || authenticated(req)) return next();
  res.status(401).json({ error: 'Sign in to control the jukebox' });
});

// liveness only: a container is healthy when it is serving, not when Navidrome is
app.get('/api/live', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

app.get('/api/health', wrap(async (_req, res) => {
  const ping = await call('ping');
  // a short budget here: when the player is stuck this probe used to hold the whole
  // health check for ten seconds, which is exactly when the UI needs an answer
  const jukebox = await call('jukeboxControl', { action: 'status' }, { timeout: 3000 }).then(
    (response) => ({ enabled: true, ...statusOf(response) }),
    (err) => ({ enabled: false, error: err.message }),
  );
  res.json({
    ok: true,
    ...serverInfo(),
    navidrome: (ping.serverVersion ?? ping.version).split(' ')[0],
    apiVersion: ping.version,
    jukebox,
  });
}));

// ------------------------------------------------------------------- playback

/** Single poll target: queue + playback state in one round trip. */
/**
 * One upstream jukebox read at a time, shared for a moment: three devices polling
 * every second were three Navidrome calls a second, and a stuck player multiplied
 * every one of them into a timeout.
 */
const stateCache = { at: 0, payload: null, inflight: null };
let lastObserved = null;

/** Albums that played, newest first — the source of the "last played" sort. */
const RECENT_ALBUMS_MAX = 40;
const recentAlbums = [];

function noteAlbum(previous, next) {
  const index = previous?.status?.currentIndex ?? -1;
  const entry = previous?.entries?.[index];
  if (!entry?.albumId || !previous.status.playing) return;
  const changed = !next || next.status.currentIndex !== index || !next.status.playing;
  if (!changed) return;
  const at = recentAlbums.indexOf(entry.albumId);
  if (at !== -1) recentAlbums.splice(at, 1);
  recentAlbums.unshift(entry.albumId);
  recentAlbums.length = Math.min(recentAlbums.length, RECENT_ALBUMS_MAX);
}

/** The albums played here, in order, as full album records. */
async function recentlyPlayed(size, offset) {
  const ids = recentAlbums.slice(offset, offset + size);
  const albums = await Promise.all(
    ids.map((id) => call('getAlbum', { id }).then((response) => album(response.album), () => null)),
  );
  return albums.filter(Boolean);
}
const STATE_TTL_MS = 900;

function invalidateState() {
  stateCache.at = 0;
  stateCache.payload = null;
}

function readState() {
  if (stateCache.payload && Date.now() - stateCache.at < STATE_TTL_MS) {
    return Promise.resolve(stateCache.payload);
  }
  if (stateCache.inflight) return stateCache.inflight;
  stateCache.inflight = call('jukeboxControl', { action: 'get' })
    .catch((err) => {
      // browsing a library whose server has jukebox mode off is fine; just show no queue
      if (jukeboxOff(err)) return null;
      throw err;
    })
    .then((response) => {
      const payload = response ? playlistOf(response.jukeboxPlaylist) : emptyState();
      // Navidrome keeps no play history for jukebox playback, so the albums that
      // actually played are remembered here instead of scrobbling every track.
      noteAlbum(lastObserved, payload);
      lastObserved = payload;
      stateCache.payload = payload;
      stateCache.at = Date.now();
      return payload;
    })
    .finally(() => {
      stateCache.inflight = null;
    });
  return stateCache.inflight;
}

app.get('/api/state', wrap(async (_req, res) => {
  res.json(await readState());
}));

// preferences belong to the Navidrome account, not to one browser
app.get('/api/prefs', wrap(async (_req, res) => {
  res.json({ prefs: await getProfile(serverInfo().user) });
}));

app.put('/api/prefs', wrap(async (req, res) => {
  res.json({ prefs: await putProfile(serverInfo().user, req.body?.prefs ?? {}) });
}));

app.post('/api/control', wrap(async (req, res) => serialWrite(async () => {
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
    // the next poll must not serve the state from before this action
    invalidateState();
    res.json(statusOf(response));
  })));

/**
 * Queue the songs right after the current one. `set` resets playback to index 0 and
 * stops it, so the current track is re-skipped (with the position it had reached)
 * and resumed afterwards - otherwise "play next" would jump to the start.
 */
app.post('/api/queue/next', wrap(async (req, res) => serialWrite(async () => {
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
})));

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

/**
 * One jukebox write at a time. Navidrome switches tracks without a lock, so two
 * overlapping actions (a skip from one device and a start from another, say) can
 * each spawn an mpv and play two tracks at once.
 */
let writeChain = Promise.resolve();

function serialWrite(task) {
  const run = writeChain.then(task, task);
  writeChain = run.catch(() => {});
  return run;
}

/** Play immediately: replace the queue, jump to a track and start. */
app.post('/api/play', wrap(async (req, res) => serialWrite(async () => {
  const { ids, index = 0 } = req.body ?? {};
  if (!Array.isArray(ids) || ids.length === 0) throw badRequest('ids must be a non-empty array');
  if (!Number.isInteger(index) || index < 0 || index >= ids.length) throw badRequest('index must be inside ids');
  await call('jukeboxControl', { action: 'set', id: ids }, { repeat: ['id'] });
  await waitForQueue(ids);
  await call('jukeboxControl', { action: 'skip', index });
  const response = await call('jukeboxControl', { action: 'start' });
  res.json(statusOf(response));
})));

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
  // Navidrome has no release-date order, and byYear walks the range in the direction
  // it is given: newest year first means asking for this year down to 1900
  const years = type === 'byYear' ? { fromYear: new Date().getFullYear(), toYear: 1900 } : {};
  if (type === 'recent') {
    const albums = await recentlyPlayed(size, offset);
    return res.json({ albums, offset, hasMore: albums.length === size });
  }
  const response = await call('getAlbumList2', { type, size, offset, ...years });
  const albums = (response.albumList2?.album ?? []).map(album);
  res.json({ albums, offset, hasMore: albums.length === size });
}));

app.get('/api/albums/:id', wrap(async (req, res) => {
  const response = await call('getAlbum', { id: req.params.id });
  res.json({
    album: {
      ...album(response.album),
      // Navidrome's OpenSubsonic discTitles: one per disc, title possibly empty
      discTitles: (response.album.discTitles ?? [])
        .filter((entry) => entry.title)
        .map(({ disc, title }) => ({ disc, title })),
    },
    songs: (response.album.song ?? []).map(song),
  });
}));

// totals for the library tab pills; null when the server is not Navidrome
let counts = { at: 0, value: { albums: null } };

app.get('/api/counts', wrap(async (_req, res) => {
  if (Date.now() - counts.at > 300_000) {
    counts = { at: Date.now(), value: { albums: await nativeTotal('album').catch(() => null) } };
  }
  res.json(counts.value);
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

// every track an artist has, album order; the client's "play all" needs one list
app.get('/api/artists/:id/songs', wrap(async (req, res) => {
  const artist = await call('getArtist', { id: req.params.id });
  const albums = artist.artist.album ?? [];
  const songsOf = await Promise.all(
    albums.map((entry) =>
      call('getAlbum', { id: entry.id }).then(
        (albumResponse) => (albumResponse.album.song ?? []).map(song),
        () => [],
      ),
    ),
  );
  res.json({ songs: songsOf.flat() });
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

const LRCLIB_HEADERS = { 'User-Agent': 'juuku/0.1 (local jukebox remote)' };

function lyricsFromLrclibBody(body) {
  const synced = body.syncedLyrics ? parseLrc(body.syncedLyrics) : null;
  const plain = body.plainLyrics
    ? body.plainLyrics
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((text) => ({ text: text.trim() }))
    : null;
  const lines = synced?.length ? synced : plain;
  if (!lines?.length) return null;
  return { source: 'lrclib', synced: Boolean(synced?.length), lines };
}

async function lrclibJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: LRCLIB_HEADERS });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

/**
 * LRCLIB has a strict endpoint that wants the exact names and duration, and a
 * search endpoint that tolerates the tags we actually have. Files often carry
 * "Rong feat. Robyn" while LRCLIB indexes "Rong", so a search with the featured
 * credit stripped and a duration match is what usually resolves it.
 */
async function lyricsFromLrclib(entry) {
  const title = cleanTitle(entry.title);
  const artist = cleanArtist(entry.artist);
  // a remix, edit or live take usually has no lyrics of its own, and the original's
  // words and timings do not fit it: require the same title instead of hunting
  const versioned = versionMarked(entry.title);

  const exact = new URL('https://lrclib.net/api/get');
  exact.searchParams.set('artist_name', entry.artist ?? '');
  exact.searchParams.set('track_name', entry.title ?? '');
  if (entry.album) exact.searchParams.set('album_name', entry.album);
  if (entry.duration) exact.searchParams.set('duration', String(entry.duration));
  const hit = await lrclibJson(exact).catch(() => null);
  // the exact endpoint is no safer than the search for a version: LRCLIB answered a
  // remix title with the original's words, so the returned title has to be ours
  const direct =
    hit && (!versioned || sameTitle(hit.trackName ?? hit.title ?? '', entry.title))
      ? lyricsFromLrclibBody(hit)
      : null;
  if (direct) return direct;

  const searches = versioned
    ? [{ track: entry.title, artist, expectTitle: entry.title, tolerance: 3 }]
    : [
        { track: title, artist, expectTitle: title, tolerance: 3 },
        { track: title, expectTitle: title, tolerance: 3 },
      ];

  for (const query of searches) {
    if (!query.track) continue;
    const search = new URL('https://lrclib.net/api/search');
    search.searchParams.set('track_name', query.track);
    if (query.artist) search.searchParams.set('artist_name', query.artist);
    const results = await lrclibJson(search).catch(() => null);
    const best = pickCandidate(results, entry.duration, query.tolerance, { expectTitle: query.expectTitle });
    if (best) {
      // only trust the timestamps when the lengths agree; otherwise take the words
      // unsynced rather than scroll them against the wrong recording
      const body = best.timingTrusted ? best.entry : { plainLyrics: best.entry.plainLyrics };
      const found = lyricsFromLrclibBody(body);
      if (found) return found;
    }
  }
  return null;
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
  } else if (req.query.lookup === '1') {
    // Opt-in only (Settings): LRCLIB guesses. It hands the original's words to a
    // remix, gives instrumental tracks somebody else's lyrics, and files junk under
    // titles that look close, so a file without lyrics shows none by default.
    const songResponse = await call('getSong', { id }).catch(() => null);
    const huntable = songResponse?.song && !versionMarked(songResponse.song.title);
    if (huntable) {
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
  // the heart button owns this one; deleting it would orphan every favourite
  protected: entry.name === FAVORITES_PLAYLIST,
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
  if (name === FAVORITES_PLAYLIST) {
    throw new ApiError(409, `“${FAVORITES_PLAYLIST}” is where the heart saves tracks - it can’t be deleted`);
  }
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
  app.use(
    express.static(dist, {
      setHeaders(res, path) {
        // hashed assets never change; the shell must, or an installed app keeps
        // showing a build from days ago
        if (path.endsWith('index.html') || path.endsWith('manifest.webmanifest')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (path.includes(`${sep}assets${sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  app.get('/{*path}', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(dist, 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  const { url, user } = serverInfo();
  console.log(`juuku api on http://${HOST}:${PORT} -> ${url} as ${user}`);
});
