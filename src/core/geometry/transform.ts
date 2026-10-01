import type { Point } from './point';

/**
 * Moves a world point into a rotated shape's local frame: relative to the shape's
 * center, with the shape's rotation undone. Exact tests then treat it as unrotated.
 */
export function toLocalPoint(
  world: Readonly<Point>,
  centerX: number,
  centerY: number,
  rotation: number,
  out: Point,
): Point {
  const dx = world.x - centerX;
  const dy = world.y - centerY;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  out.x = dx * cos + dy * sin;
  out.y = -dx * sin + dy * cos;
  return out;
}
