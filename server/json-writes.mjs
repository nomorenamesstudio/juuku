/**
 * Every write to this API is JSON and nothing else.
 *
 * `express.json()` only parses that content type, and a cross-site form cannot send
 * it without a preflight — unless the route never reads a body at all, which is the
 * player restart: that one was reachable by a plain form POST, the one hole in the
 * "SameSite + JSON body" answer to CSRF.
 */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function jsonWrites(req, res, next) {
  if (!WRITE_METHODS.has(req.method)) return next();
  // the header itself, not req.is(): type-is answers null when the request carries no
  // body, and a DELETE with nothing in it is still a legitimate JSON write
  const [type] = String(req.headers['content-type'] ?? '').split(';');
  if (type.trim().toLowerCase() === 'application/json') return next();
  res.status(415).json({ error: 'Send this as application/json' });
}
