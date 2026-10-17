import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const COOKIE = 'juuku_session';
export const MAX_AGE = 30 * 24 * 60 * 60;

const digest = (value) => createHash('sha256').update(String(value)).digest();

/**
 * One optional shared password, no accounts. Empty password = no auth at all,
 * which is the LAN-only default. Sessions are a signed expiry stamp, so nothing
 * is stored server-side and changing the password signs everyone out.
 */
export function createAuth(password, now = () => Date.now()) {
  const enabled = Boolean(password);
  const key = digest(`juuku-session:${password ?? ''}`);
  const sign = (exp) => createHmac('sha256', key).update(String(exp)).digest('base64url');

  return {
    enabled,
    verify(candidate) {
      if (!enabled || typeof candidate !== 'string') return false;
      return timingSafeEqual(digest(candidate), digest(password));
    },
    issue() {
      const exp = Math.floor(now() / 1000) + MAX_AGE;
      return `${exp}.${sign(exp)}`;
    },
    valid(token) {
      if (!enabled || typeof token !== 'string') return false;
      const [rawExp, signature] = token.split('.');
      const exp = Number(rawExp);
      if (!Number.isFinite(exp) || exp * 1000 < now()) return false;
      if (typeof signature !== 'string') return false;
      const expected = sign(exp);
      if (signature.length !== expected.length) return false;
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    },
  };
}

export function readCookie(header, name) {
  if (typeof header !== 'string') return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/** Failed sign-ins per address, so a shared password is not brute-forceable. */
export function createThrottle({ limit = 8, windowMs = 10 * 60 * 1000 } = {}) {
  const attempts = new Map();

  return {
    blocked(address) {
      const entry = attempts.get(address);
      if (!entry) return false;
      if (entry.resetAt < Date.now()) {
        attempts.delete(address);
        return false;
      }
      return entry.count >= limit;
    },
    fail(address) {
      const entry = attempts.get(address);
      if (!entry || entry.resetAt < Date.now()) {
        attempts.set(address, { count: 1, resetAt: Date.now() + windowMs });
        return;
      }
      entry.count += 1;
    },
    clear(address) {
      attempts.delete(address);
    },
  };
}
