import { assertNever } from '../assertNever';
import type { DocumentState } from '../document';
import type { Bounds } from '../geometry/bounds';
import type { Point } from '../geometry/point';
import {
  boundsContain,
  boundsCorners,
  convexPolygonsIntersect,
  segmentIntersectsBounds,
} from '../geometry/polygon';
import { rotatedBoxCorners, toWorldPoint } from '../geometry/transform';
import { pathWorldPoints, shapeBox, shapeGeometryBounds } from '../shapeGeometry';
import type { Shape, ShapeId } from '../shapes';
import type { SpatialIndex } from '../spatial/spatialIndex';

export type MarqueeMode = 'inside' | 'touching';

/** Sides of the polygon that stands in for an ellipse when testing "touching". */
const ELLIPSE_SEGMENTS = 48;

/**
 * Shapes the marquee selects, bottom to top. "inside" (the default) needs the whole
 * shape inside the area; "touching" (Ctrl / ⌘ held) needs any part of it.
 */
export function shapesInMarquee(
  document: DocumentState,
  index: SpatialIndex,
  area: Bounds,
  mode: MarqueeMode,
): ShapeId[] {
  const selected: Shape[] = [];
  for (const id of index.query(area)) {
    const shape = document.shapes.get(id);
    if (shape !== undefined && matches(shape, area, mode)) {
      selected.push(shape);
    }
  }
  return selected.sort((a, b) => a.zIndex - b.zIndex).map((shape) => shape.id);
}

function matches(shape: Shape, area: Bounds, mode: MarqueeMode): boolean {
  return mode === 'inside'
    ? boundsContain(area, shapeGeometryBounds(shape))
    : shapeTouchesBounds(shape, area);
}

export function shapeTouchesBounds(shape: Shape, area: Bounds): boolean {
  switch (shape.type) {
    case 'rectangle':
    case 'text':
      return convexPolygonsIntersect(
        rotatedBoxCorners(shapeBox(shape), shape.rotation),
        boundsCorners(area),
      );
    case 'ellipse':
      return convexPolygonsIntersect(ellipsePolygon(shape), boundsCorners(area));
    case 'line':
    case 'arrow':
    case 'pen':
      return pathTouchesBounds(pathWorldPoints(shape), area);
    default:
      return assertNever(shape);
  }
}

function pathTouchesBounds(points: readonly Point[], area: Bounds): boolean {
  const [first] = points;
  if (first === undefined) {
    return false;
  }
  if (points.length === 1) {
    return segmentIntersectsBounds(first, first, area);
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined && segmentIntersectsBounds(a, b, area)) {
      return true;
    }
  }
  return false;
}

/** A polygon circumscribing the ellipse, so it never misses a real touch. */
function ellipsePolygon(shape: Shape): Point[] {
  const box = shapeBox(shape);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  // Scaling by 1/cos(π/n) puts the polygon's edges on the outside of the ellipse.
  const grow = 1 / Math.cos(Math.PI / ELLIPSE_SEGMENTS);
  const points: Point[] = [];
  for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
    const t = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
    const local = {
      x: (Math.cos(t) * box.width * grow) / 2,
      y: (Math.sin(t) * box.height * grow) / 2,
    };
    points.push(toWorldPoint(local, centerX, centerY, shape.rotation, { x: 0, y: 0 }));
  }
  return points;
}
