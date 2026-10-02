/** Options rendered around the active one; the rest exist only as aria-setsize. */
export const LIST_WINDOW = 50;

/**
 * The slice of a long list to render: `size` items with the active one near the
 * middle, clamped to the ends. [start, end) indices.
 */
export function listWindow(count: number, active: number, size = LIST_WINDOW) {
  const start = Math.max(0, Math.min(active - Math.floor(size / 2), count - size));
  return { start, end: Math.min(count, start + size) };
}
