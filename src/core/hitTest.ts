import { assertNever } from './assertNever';
import { boundsAround } from './geometry/bounds';
import {
  distanceToEllipse,
  distanceToRectOutline,
  distanceToSegment,
  isInsideEllipse,
} from './geometry/distance';
import { createPoint, type Point } from './geometry/point';
import { toLocalPoint } from './geometry/transform';
import type { DocumentState } from './document';
import { ARROW_HEAD_SIDES, arrowHeadWing, isFilled, shapeBox } from './shapeGeometry';
import type { ArrowShape, PathPoint, Shape, ShapeId } from './shapes';
import type { SpatialIndex } from './spatial/spatialIndex';

/** How close (in screen pixels, at any zoom) a pointer must be to hit a thin stroke. */
export const HIT_TOLERANCE_PX = 6;

// Hit-testing runs on every pointermove; scratch points keep it allocation-free.
const local = createPoint();
const wing = createPoint();

/** World-space tolerance for the current zoom: 6 screen pixels whatever the zoom. */
export function hitToleranceAt(zoom: number): number {
  return HIT_TOLERANCE_PX / zoom;
}

/**
 * Exact test for one shape, in its own unrotated frame. Unfilled shapes are hit only
 * near their stroke; filled shapes anywhere inside too. `tolerance` is in world units.
 */
export function hitsShape(shape: Shape, point: Readonly<Point>, tolerance: number): boolean {
  const box = shapeBox(shape);
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  toLocalPoint(point, box.x + halfWidth, box.y + halfHeight, shape.rotation, local);
  const reach = tolerance + shape.style.strokeWidth / 2;
  const filled = isFilled(shape);

  switch (shape.type) {
    case 'rectangle':
      if (filled && Math.abs(local.x) <= halfWidth && Math.abs(local.y) <= halfHeight) {
        return true;
      }
      return distanceToRectOutline(local.x, local.y, halfWidth, halfHeight) <= reach;
    case 'text':
      // Text has no outline to aim for: its whole box counts, plus the tolerance.
      return (
        distanceToRectOutline(local.x, local.y, halfWidth, halfHeight) <= tolerance ||
        (Math.abs(local.x) <= halfWidth && Math.abs(local.y) <= halfHeight)
      );
    case 'ellipse':
      if (filled && isInsideEllipse(local.x, local.y, halfWidth, halfHeight)) {
        return true;
      }
      return distanceToEllipse(local.x, local.y, halfWidth, halfHeight) <= reach;
    case 'line':
    case 'pen':
    case 'arrow': {
      // Path points are relative to (x, y); move the local point into that frame.
      const px = local.x + box.x + halfWidth - shape.x;
      const py = local.y + box.y + halfHeight - shape.y;
      return (
        distanceToPolyline(px, py, shape.points) <= reach ||
        (shape.type === 'arrow' && distanceToArrowHead(px, py, shape) <= reach)
      );
    }
    default:
      return assertNever(shape);
  }
}

/** The topmost shape under `point`, or null. Candidates come from the spatial index. */
export function hitTest(
  document: DocumentState,
  index: SpatialIndex,
  point: Readonly<Point>,
  zoom: number,
): ShapeId | null {
  const tolerance = hitToleranceAt(zoom);
  let top: Shape | null = null;
  for (const id of index.query(boundsAround(point.x, point.y, tolerance))) {
    const shape = document.shapes.get(id);
    if (shape !== undefined && (top === null || shape.zIndex > top.zIndex)) {
      if (hitsShape(shape, point, tolerance)) {
        top = shape;
      }
    }
  }
  return top?.id ?? null;
}

/** Every shape under `point`, topmost first. Alt + click cycles through this list (M4). */
export function hitTestAll(
  document: DocumentState,
  index: SpatialIndex,
  point: Readonly<Point>,
  zoom: number,
): ShapeId[] {
  const tolerance = hitToleranceAt(zoom);
  const hits: Shape[] = [];
  for (const id of index.query(boundsAround(point.x, point.y, tolerance))) {
    const shape = document.shapes.get(id);
    if (shape !== undefined && hitsShape(shape, point, tolerance)) {
      hits.push(shape);
    }
  }
  return hits.sort((a, b) => b.zIndex - a.zIndex).map((shape) => shape.id);
}

function distanceToPolyline(px: number, py: number, points: readonly PathPoint[]): number {
  const first = points[0];
  if (first === undefined) {
    return Infinity;
  }
  let best = Math.hypot(px - first.x, py - first.y);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined) {
      best = Math.min(best, distanceToSegment(px, py, a.x, a.y, b.x, b.y));
    }
  }
  return best;
}

function distanceToArrowHead(px: number, py: number, shape: ArrowShape): number {
  const tip = shape.points[1];
  let best = Infinity;
  for (const side of ARROW_HEAD_SIDES) {
    arrowHeadWing(shape, side, wing);
    best = Math.min(best, distanceToSegment(px, py, tip.x, tip.y, wing.x, wing.y));
  }
  return best;
}
