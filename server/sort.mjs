/**
 * Alphabetical order that ignores decoration. Library titles start with quotes,
 * ellipses, brackets and asterisks often enough that a literal collation puts
 * `"Heroes"` before `10.000 Days` and `…I Care Because You Do` at the very top:
 * the sort key starts at the first letter or digit instead, and accents are folded
 * so `Á` sits with `A`. A name with nothing but symbols keys to an empty string,
 * which keeps it in front — there is nowhere else sensible to put it.
 */
export function sortKey(value) {
  const text = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  const match = text.match(/[\p{L}\p{N}]/u);
  return match ? text.slice(match.index) : '';
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Compare two strings by their decorated-stripped keys, then by the raw text. */
export function compareAlphabetical(a, b) {
  const byKey = collator.compare(sortKey(a), sortKey(b));
  return byKey !== 0 ? byKey : collator.compare(String(a ?? ''), String(b ?? ''));
}

/** Sort a list by one of its fields with the decorated-stripped order. */
export function alphabeticalBy(list, field) {
  return [...list].sort((a, b) => compareAlphabetical(a?.[field], b?.[field]));
}
