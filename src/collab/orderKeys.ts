/**
 * Fractional order keys: strings that sort in draw order, with room between any two.
 * Two people inserting at once never renumber each other's shapes; they each pick a
 * key between their neighbors. Equal keys (the same spot, picked at the same time) are
 * ordered by shape ID, the same on every client.
 */

/** Base 62, in ASCII order so plain string comparison sorts keys. */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;
const ZERO = DIGITS.charAt(0);

const digit = (key: string, at: number): number =>
  at < key.length ? DIGITS.indexOf(key.charAt(at)) : 0;

/**
 * A key strictly between `before` and `after` (null: no bound). Keys never end in the
 * smallest digit, so there is always room below any key.
 */
export function keyBetween(before: string | null, after: string | null): string {
  const low = before ?? '';
  if (after !== null && low >= after) {
    throw new Error(`No key between "${low}" and "${after}".`);
  }
  return midpoint(low, after);
}

function midpoint(low: string, high: string | null): string {
  if (high !== null) {
    // Shared leading digits stay; the rest is a midpoint of what follows.
    let shared = 0;
    while ((low.charAt(shared) || ZERO) === high.charAt(shared)) shared++;
    if (shared > 0) {
      return high.slice(0, shared) + midpoint(low.slice(shared), high.slice(shared));
    }
  }
  const lowDigit = digit(low, 0);
  const highDigit = high === null ? BASE : digit(high, 0);
  if (highDigit - lowDigit > 1) {
    return DIGITS.charAt(Math.round((lowDigit + highDigit) / 2));
  }
  // Neighboring first digits: a longer `high` leaves its first digit free.
  if (high !== null && high.length > 1) return high.charAt(0);
  return DIGITS.charAt(lowDigit) + midpoint(low.slice(1), null);
}

/** `count` increasing keys between two bounds, split evenly so none grows long. */
export function keysBetween(before: string | null, after: string | null, count: number): string[] {
  if (count <= 0) return [];
  const middle = keyBetween(before, after);
  const left = Math.floor((count - 1) / 2);
  return [
    ...keysBetween(before, middle, left),
    middle,
    ...keysBetween(middle, after, count - 1 - left),
  ];
}

/** Draw order: by key, then by ID for keys picked at the same spot at the same time. */
export function compareOrder(
  a: { readonly key: string; readonly id: string },
  b: { readonly key: string; readonly id: string },
): number {
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The keys to write so `order` (bottom to top) sorts correctly, changing as few as
 * possible: shapes on the longest run of already-increasing keys keep theirs; the rest
 * (new shapes, moved shapes, tied keys) get fresh keys between their kept neighbors.
 */
export function assignKeys(
  order: readonly string[],
  current: ReadonlyMap<string, string>,
): Map<string, string> {
  const kept = longestIncreasing(order.map((id) => current.get(id) ?? null));
  const changes = new Map<string, string>();
  let index = 0;
  while (index < order.length) {
    if (kept.has(index)) {
      index++;
      continue;
    }
    // A run of shapes that need keys, between two kept (or bound) neighbors.
    let end = index;
    while (end < order.length && !kept.has(end)) end++;
    const before =
      index > 0
        ? (changes.get(order[index - 1] ?? '') ?? current.get(order[index - 1] ?? '') ?? null)
        : null;
    const after = end < order.length ? (current.get(order[end] ?? '') ?? null) : null;
    keysBetween(before, after, end - index).forEach((key, offset) => {
      changes.set(order[index + offset] ?? '', key);
    });
    index = end;
  }
  return changes;
}

/** Indices of a longest strictly increasing run of keys (missing keys never count). */
function longestIncreasing(keys: readonly (string | null)[]): Set<number> {
  // Patience sorting: tails[k] is the index ending the best run of length k + 1.
  const tails: number[] = [];
  const previous = new Array<number>(keys.length).fill(-1);
  keys.forEach((key, index) => {
    if (key === null) return;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((keys[tails[mid] ?? 0] ?? '') < key) low = mid + 1;
      else high = mid;
    }
    previous[index] = low > 0 ? (tails[low - 1] ?? -1) : -1;
    tails[low] = index;
  });
  const run = new Set<number>();
  for (let at = tails.at(-1) ?? -1; at !== -1; at = previous[at] ?? -1) run.add(at);
  return run;
}
