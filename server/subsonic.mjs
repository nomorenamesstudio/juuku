import { createHash, randomBytes } from 'node:crypto';

const API_VERSION = '1.16.1';
const CLIENT = 'Juuku';

const config = {
  url: (process.env.NAVIDROME_URL ?? 'http://127.0.0.1:4533').replace(/\/+$/, ''),
  user: process.env.NAVIDROME_USER ?? 'admin',
  password: process.env.NAVIDROME_PASSWORD ?? 'juuku',
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Salted token auth: the password never travels, only md5(password + salt).
function authParams() {
  const salt = randomBytes(8).toString('hex');
  const token = createHash('md5').update(config.password + salt).digest('hex');
  return { u: config.user, t: token, s: salt, v: API_VERSION, c: CLIENT, f: 'json' };
}

function query(params, { repeat } = {}) {
  const search = new URLSearchParams(authParams());
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    // Subsonic takes repeated params (multiple `id`s), not comma lists.
    for (const item of repeat?.includes(key) ? value : [value]) {
      search.append(key, String(item));
    }
  }
  return search.toString();
}

export async function call(endpoint, params = {}, options = {}) {
  const url = `${config.url}/rest/${endpoint}?${query(params, options)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(options.timeout ?? 10000) });
  } catch (err) {
    // a timeout is not a dead server: Navidrome stays reachable while its jukebox
    // player (mpv) hangs and every jukeboxControl call waits on it
    const timedOut = err?.name === 'TimeoutError' || String(err?.message).includes('aborted due to timeout');
    throw new ApiError(
      502,
      timedOut
        ? `Navidrome did not answer within ${Math.round((options.timeout ?? 10000) / 1000)}s — its jukebox player looks stuck`
        : `Navidrome unreachable at ${config.url}: ${err.message}`,
    );
  }
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text)['subsonic-response'];
  } catch {
    throw new ApiError(502, `Navidrome returned ${res.status} for ${endpoint}: ${text.slice(0, 200)}`);
  }
  if (!body || body.status !== 'ok') {
    const detail = body?.error;
    throw new ApiError(
      detail?.code === 40 ? 401 : 502,
      detail ? `${endpoint}: ${detail.message} (code ${detail.code})` : `${endpoint}: ${text.slice(0, 200)}`,
    );
  }
  return body;
}

export async function binary(endpoint, params) {
  const url = `${config.url}/rest/${endpoint}?${query(params)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const body = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new ApiError(502, `${endpoint}: ${res.status}`);
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  // Navidrome answers 200 with a subsonic error body when it cannot produce the file:
  // no artwork for that id, or its own artwork store unreadable. Handing that on as
  // artwork made the browser cache a JSON error in place of a cover for a day.
  if (!contentType.startsWith('image/')) {
    const code = /"code"\s*:\s*(\d+)/.exec(body.toString('utf8').slice(0, 400))?.[1];
    throw new ApiError(code === '70' ? 404 : 502, `${endpoint}: no image (${contentType}${code ? `, code ${code}` : ''})`);
  }
  return { body, contentType };
}

/**
 * Subsonic never returns a total, but Navidrome's own API puts it in X-Total-Count.
 * Only the album total is worth it: its artist count includes every credit row
 * (827 on the main library) while the Subsonic artist list shows 73.
 */
export async function nativeTotal(resource) {
  const login = await fetch(`${config.url}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: config.user, password: config.password }),
  });
  if (!login.ok) throw new ApiError(login.status, `Navidrome sign-in failed (${login.status})`);

  const { token } = await login.json();
  const response = await fetch(`${config.url}/api/${resource}?_end=1&_sort=name`, {
    headers: { 'x-nd-authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new ApiError(response.status, `Navidrome ${resource} count failed (${response.status})`);

  const total = Number(response.headers.get('x-total-count'));
  return Number.isFinite(total) && total >= 0 ? total : null;
}

export function serverInfo() {
  return { url: config.url, user: config.user };
}
