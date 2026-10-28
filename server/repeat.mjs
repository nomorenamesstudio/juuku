/**
 * Repeat is a client-side idea in Subsonic — the protocol has no repeat mode — so juuku
 * keeps the queue looping itself. That worked only while a client was open: with the
 * phone in a pocket the queue ran out and stayed silent until the app came back and
 * noticed. The server owns it now, which needs the mode and one decision.
 */
export const REPEAT_MODES = ['off', 'all', 'one'];

/**
 * Where a finished queue should resume, or null when nothing is due. Navidrome leaves
 * `playing=false`, the last index and position 0 when the queue runs out (measured),
 * which is what separates "finished" from a manual pause — a pause keeps its position.
 */
export function repeatAtEnd(mode, state) {
  if (mode !== 'all' && mode !== 'one') return null;
  const status = state?.status;
  const entries = state?.entries ?? [];
  if (!status || status.playing || entries.length === 0) return null;
  const last = entries.length - 1;
  // only the end of the queue is an end; stopping halfway through is a stop
  if (status.currentIndex !== last) return null;
  // position 0 means the track was never started, or the queue just ran out
  if (Number(status.position ?? 0) > 2) return null;
  return mode === 'one' ? last : 0;
}
