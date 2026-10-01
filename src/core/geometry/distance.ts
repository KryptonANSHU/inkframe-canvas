// Scalar arguments instead of point objects: these run for every candidate on
// every hit-test, so they allocate nothing.

export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance to the outline of an axis-aligned rectangle centered on the origin. */
export function distanceToRectOutline(
  px: number,
  py: number,
  halfWidth: number,
  halfHeight: number,
): number {
  const outsideX = Math.abs(px) - halfWidth;
  const outsideY = Math.abs(py) - halfHeight;
  if (outsideX <= 0 && outsideY <= 0) {
    return Math.min(-outsideX, -outsideY);
  }
  return Math.hypot(Math.max(outsideX, 0), Math.max(outsideY, 0));
}

export function isInsideEllipse(px: number, py: number, radiusX: number, radiusY: number): boolean {
  if (radiusX === 0 || radiusY === 0) {
    return false;
  }
  const nx = px / radiusX;
  const ny = py / radiusY;
  return nx * nx + ny * ny <= 1;
}

const ELLIPSE_ITERATIONS = 4;

/**
 * Distance to the outline of an axis-aligned ellipse centered on the origin.
 * There is no closed form, so this refines a guess for the nearest point a fixed
 * number of times, using the ellipse's local center of curvature at each step.
 * Measured worst error: 3.7e-6 of the larger radius, at aspect ratios up to 1000:1,
 * against 200,000-point outline sampling. distance.test.ts keeps a lighter check.
 */
export function distanceToEllipse(
  px: number,
  py: number,
  radiusX: number,
  radiusY: number,
): number {
  const x = Math.abs(px);
  const y = Math.abs(py);
  if (radiusX === 0 || radiusY === 0) {
    return distanceToSegment(x, y, 0, 0, radiusX, radiusY);
  }
  const a = radiusX;
  const b = radiusY;
  let tx = Math.SQRT1_2;
  let ty = Math.SQRT1_2;
  for (let i = 0; i < ELLIPSE_ITERATIONS; i++) {
    // (ex, ey) is the center of curvature for the current nearest-point guess.
    const ex = ((a * a - b * b) * tx ** 3) / a;
    const ey = ((b * b - a * a) * ty ** 3) / b;
    const r = Math.hypot(a * tx - ex, b * ty - ey);
    const q = Math.hypot(x - ex, y - ey);
    if (q === 0) {
      break;
    }
    tx = Math.max(0, Math.min(1, (((x - ex) * r) / q + ex) / a));
    ty = Math.max(0, Math.min(1, (((y - ey) * r) / q + ey) / b));
    const length = Math.hypot(tx, ty);
    tx /= length;
    ty /= length;
  }
  return Math.hypot(a * tx - x, b * ty - y);
}
