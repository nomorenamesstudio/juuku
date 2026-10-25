/**
 * A "most recent first" list with no duplicates: the album that just played moves to
 * the front instead of appearing twice, and the list never grows past `max`.
 */
export function bump(list, value, max) {
  if (!value) return list;
  const at = list.indexOf(value);
  if (at !== -1) list.splice(at, 1);
  list.unshift(value);
  if (list.length > max) list.length = max;
  return list;
}

/**
 * Which playlist a logged entry refers to now: by id first, then by name, because
 * Navidrome hands out a new id when a playlist is recreated (the importer does that).
 * An entry that resolves to neither is gone; it still describes something played if a
 * name was stored, and otherwise it is dropped.
 */
export function resolvePlaylist(logged, byId, byName) {
  const current = byId.get(logged.id) ?? (logged.name ? byName.get(logged.name) : undefined);
  if (current) return { entry: current };
  return logged.name ? { missing: { id: logged.id, name: logged.name } } : null;
}

/**
 * Which album just finished playing, if any: the one on screen before this read, and
 * only once it stopped being the current track. A queue a playlist started reports
 * nothing — its tracks are the playlist's history, not the albums'.
 */
export function albumThatPlayed(previous, next, cameFromPlaylist) {
  const index = previous?.status?.currentIndex ?? -1;
  const entry = previous?.entries?.[index];
  if (!entry?.albumId || !previous?.status?.playing) return null;
  // a playlist's own tracks are the playlist's rows; an album queued behind one still
  // counts, so the decision belongs to the track that just finished, not the queue
  if (cameFromPlaylist(entry.id)) return null;
  const changed = !next || next.status.currentIndex !== index || !next.status.playing;
  return changed ? entry.albumId : null;
}

/**
 * Whether the queue is still the one juuku built. Another client replacing the queue
 * leaves the playlist bookkeeping stale, and stale bookkeeping means a row that stops
 * updating, so the first entry is the marker.
 */
export function queueStillOurs(state, firstId) {
  if (!firstId) return false;
  return state?.entries?.[0]?.id === firstId;
}
