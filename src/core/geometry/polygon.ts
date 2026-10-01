import type { Bounds } from './bounds';
import type { Point } from './point';

export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.minY >= outer.minY &&
    inner.maxX <= outer.maxX &&
    inner.maxY <= outer.maxY
  );
}

export function boundsCorners(bounds: Bounds): Point[] {
  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
}

/** Separating-axis test for two convex polygons (vertices in order, either winding). */
export function convexPolygonsIntersect(
  a: readonly Readonly<Point>[],
  b: readonly Readonly<Point>[],
): boolean {
  return !hasSeparatingAxis(a, b) && !hasSeparatingAxis(b, a);
}

function hasSeparatingAxis(
  polygon: readonly Readonly<Point>[],
  other: readonly Readonly<Point>[],
): boolean {
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    if (p === undefined || q === undefined) {
      continue;
    }
    // The edge normal is a candidate axis; the polygons are apart if their projections don't overlap.
    const axisX = q.y - p.y;
    const axisY = p.x - q.x;
    const [minA, maxA] = project(polygon, axisX, axisY);
    const [minB, maxB] = project(other, axisX, axisY);
    if (maxA < minB || maxB < minA) {
      return true;
    }
  }
  return false;
}

function project(polygon: readonly Readonly<Point>[], axisX: number, axisY: number) {
  let min = Infinity;
  let max = -Infinity;
  for (const point of polygon) {
    const value = point.x * axisX + point.y * axisY;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return [min, max] as const;
}

/** Whether the segment a–b touches the axis-aligned bounds (Liang–Barsky clipping). */
export function segmentIntersectsBounds(
  a: Readonly<Point>,
  b: Readonly<Point>,
  bounds: Bounds,
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a.x - bounds.minX],
    [dx, bounds.maxX - a.x],
    [-dy, a.y - bounds.minY],
    [dy, bounds.maxY - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) {
        return false;
      }
      continue;
    }
    const t = q / p;
    if (p < 0) {
      t0 = Math.max(t0, t);
    } else {
      t1 = Math.min(t1, t);
    }
    if (t0 > t1) {
      return false;
    }
  }
  return true;
}
