import { pathWorldPoints } from '../shapeGeometry';
import type { PathShape } from '../shapes';

/** World endpoints of a path, rounded to 1e-9 so tests can compare exactly. */
export function endpointsOf(shape: PathShape) {
  const points = pathWorldPoints(shape);
  return [points[0], points.at(-1)].map((point) =>
    point === undefined
      ? undefined
      : { x: Math.round(point.x * 1e9) / 1e9 + 0, y: Math.round(point.y * 1e9) / 1e9 + 0 },
  );
}
