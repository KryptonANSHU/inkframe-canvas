import type { Box } from './bounds';
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

/** The inverse of toLocalPoint: a point in a shape's local frame back to world space. */
export function toWorldPoint(
  local: Readonly<Point>,
  centerX: number,
  centerY: number,
  rotation: number,
  out: Point,
): Point {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const x = local.x * cos - local.y * sin + centerX;
  const y = local.x * sin + local.y * cos + centerY;
  out.x = x;
  out.y = y;
  return out;
}

/** The four corners of `box` rotated around its center: top-left, top-right, bottom-right, bottom-left. */
export function rotatedBoxCorners(box: Box, rotation: number): Point[] {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  return [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((corner) => toWorldPoint(corner, centerX, centerY, rotation, { x: 0, y: 0 }));
}
