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
