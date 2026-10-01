import { assertNever } from './assertNever';
import { inflateBox, rotatedBoxBounds, type Bounds, type Box } from './geometry/bounds';
import type { Point } from './geometry/point';
import { toWorldPoint } from './geometry/transform';
import type { ArrowShape, PathShape, Shape } from './shapes';

/** Half-angle between the arrow shaft and each side of the head. */
export const ARROW_HEAD_ANGLE = Math.PI / 7;

// Shapes are immutable, so a box computed once per shape object stays valid.
const pathBoxes = new WeakMap<PathShape, Box>();

/** The shape's unrotated box in world units. Rotation is around its center. */
export function shapeBox(shape: Shape): Box {
  switch (shape.type) {
    case 'rectangle':
    case 'ellipse':
    case 'text':
      return shape;
    case 'line':
    case 'arrow':
    case 'pen':
      return pathBox(shape);
    default:
      return assertNever(shape);
  }
}

function pathBox(shape: PathShape): Box {
  const cached = pathBoxes.get(shape);
  if (cached !== undefined) {
    return cached;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of shape.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const box =
    minX === Infinity
      ? { x: shape.x, y: shape.y, width: 0, height: 0 }
      : { x: shape.x + minX, y: shape.y + minY, width: maxX - minX, height: maxY - minY };
  pathBoxes.set(shape, box);
  return box;
}

/** Only rectangles and ellipses can be filled; paths are always stroke-only. */
export function isFilled(shape: Shape): boolean {
  return shape.style.fillColor !== null && (shape.type === 'rectangle' || shape.type === 'ellipse');
}

/** Length of each side of the arrowhead: grows with stroke width, never more than half the shaft. */
export function arrowHeadLength(shape: ArrowShape): number {
  const [start, end] = shape.points;
  const shaft = Math.hypot(end.x - start.x, end.y - start.y);
  return Math.min(shaft / 2, 8 + shape.style.strokeWidth * 3);
}

export const ARROW_HEAD_SIDES = [-1, 1] as const;

/**
 * End of one side of the arrowhead, in the same frame as the shape's points. The
 * renderer and hit-test both use this, so what you click is exactly what is drawn.
 */
export function arrowHeadWing(
  shape: ArrowShape,
  side: (typeof ARROW_HEAD_SIDES)[number],
  out: Point,
): Point {
  const [start, end] = shape.points;
  const length = arrowHeadLength(shape);
  const angle = Math.atan2(end.y - start.y, end.x - start.x) + Math.PI + side * ARROW_HEAD_ANGLE;
  out.x = end.x + Math.cos(angle) * length;
  out.y = end.y + Math.sin(angle) * length;
  return out;
}

/**
 * How far ink can reach past the shape's box. A full stroke width (not half) also
 * covers mitered rectangle corners, which stick out by half × √2.
 */
export function inkMargin(shape: Shape): number {
  const stroke = shape.style.strokeWidth;
  return shape.type === 'arrow' ? stroke + arrowHeadLength(shape) : stroke;
}

/** Axis-aligned world bounds of everything the shape draws, including rotation and stroke. */
export function shapeBounds(shape: Shape): Bounds {
  return rotatedBoxBounds(inflateBox(shapeBox(shape), inkMargin(shape)), shape.rotation);
}

/**
 * Tight world bounds of the shape's geometry, without stroke: exact for rotated
 * ellipses (not their box) and for paths (every point rotated). Marquee "fully inside"
 * and the multi-selection frame use this, so they match what the user sees.
 */
export function shapeGeometryBounds(shape: Shape): Bounds {
  const box = shapeBox(shape);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  switch (shape.type) {
    case 'ellipse': {
      const cos = Math.cos(shape.rotation);
      const sin = Math.sin(shape.rotation);
      const a = box.width / 2;
      const b = box.height / 2;
      const halfX = Math.hypot(a * cos, b * sin);
      const halfY = Math.hypot(a * sin, b * cos);
      return {
        minX: centerX - halfX,
        minY: centerY - halfY,
        maxX: centerX + halfX,
        maxY: centerY + halfY,
      };
    }
    case 'line':
    case 'arrow':
    case 'pen':
      return pathWorldBounds(shape, centerX, centerY);
    case 'rectangle':
    case 'text':
      return rotatedBoxBounds(box, shape.rotation);
    default:
      return assertNever(shape);
  }
}

function pathWorldBounds(shape: PathShape, centerX: number, centerY: number): Bounds {
  const local = { x: 0, y: 0 };
  const world = { x: 0, y: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of shape.points) {
    // Points are relative to (x, y); the shape rotates around its box center.
    local.x = shape.x + point.x - centerX;
    local.y = shape.y + point.y - centerY;
    toWorldPoint(local, centerX, centerY, shape.rotation, world);
    minX = Math.min(minX, world.x);
    minY = Math.min(minY, world.y);
    maxX = Math.max(maxX, world.x);
    maxY = Math.max(maxY, world.y);
  }
  return minX === Infinity
    ? { minX: shape.x, minY: shape.y, maxX: shape.x, maxY: shape.y }
    : { minX, minY, maxX, maxY };
}

/** A path's points in world space (rotation applied), in order. */
export function pathWorldPoints(shape: PathShape): Point[] {
  const box = shapeBox(shape);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  return shape.points.map((point) =>
    toWorldPoint(
      { x: shape.x + point.x - centerX, y: shape.y + point.y - centerY },
      centerX,
      centerY,
      shape.rotation,
      { x: 0, y: 0 },
    ),
  );
}
