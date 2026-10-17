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
    throw new ApiError(502, `Navidrome unreachable at ${config.url}: ${err.message}`);
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
  if (!res.ok) throw new ApiError(502, `${endpoint}: ${res.status}`);
  return {
    body: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  };
}

export function serverInfo() {
  return { url: config.url, user: config.user };
}
