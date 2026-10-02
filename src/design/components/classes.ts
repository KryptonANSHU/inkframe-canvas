/**
 * Joins a component's own class with the `className` a caller passes. Callers use it
 * for placement and layout (position, size, padding, flex); the look (color, border,
 * radius, shadow) stays the component's own.
 */
export function classes(
  // CSS module lookups are typed as possibly missing.
  own: string | undefined,
  placement: string | undefined,
): string | undefined {
  return [own, placement].filter((name) => name !== undefined).join(' ') || undefined;
}
