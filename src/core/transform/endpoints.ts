import type { Point } from '../geometry/point';
import { pathWorldPoints } from '../shapeGeometry';
import type { ArrowShape, LineShape } from '../shapes';
import { pathBetween } from '../tools/shapeBuilders';

export type Endpoint = 'start' | 'end';

/**
 * Moves one end of a line or arrow to a world point; the other end stays where it is
 * on screen. The result is unrotated (its points carry the direction), at least 1 long.
 */
export function moveEndpoint<T extends LineShape | ArrowShape>(
  shape: T,
  endpoint: Endpoint,
  to: Readonly<Point>,
): T {
  const [start = to, end = to] = pathWorldPoints(shape);
  const geometry = endpoint === 'start' ? pathBetween(to, end) : pathBetween(start, to);
  return { ...shape, ...geometry, rotation: 0 };
}
