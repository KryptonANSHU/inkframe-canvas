/** Pixels per world unit in a PNG export: sharp on high-DPI screens. */
export const PNG_SCALE = 2;
/** Browsers refuse canvases past a size; these stay under the strictest (Safari's). */
const MAX_SIDE_PX = 16_384;
const MAX_AREA_PX = 16_777_216;

/**
 * The scale for a PNG of a `width` × `height` world area: PNG_SCALE, or less when
 * that would exceed what browsers can draw. Large drawings export smaller, not fail.
 */
export function pngScale(width: number, height: number): number {
  const limits = [PNG_SCALE, MAX_SIDE_PX / width, MAX_SIDE_PX / height];
  limits.push(Math.sqrt(MAX_AREA_PX / (width * height)));
  return Math.min(...limits.filter((limit) => Number.isFinite(limit) && limit > 0));
}
