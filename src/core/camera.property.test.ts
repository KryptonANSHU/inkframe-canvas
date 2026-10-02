import fc from 'fast-check';
import { describe, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, screenToWorld, worldToScreen, zoomAt, type Camera } from './camera';
import type { Point } from './geometry/point';

// The precision guarantee holds for world coordinates up to ±1e6 units.
// Beyond that, float spacing alone (ulp(1e6) ≈ 1.2e-10) eats most of the 1e-9 budget.
const WORLD_LIMIT = 1e6;
const TOLERANCE = 1e-9;

const coordinate = fc.double({ min: -WORLD_LIMIT, max: WORLD_LIMIT, noNaN: true });
const point = fc.record({ x: coordinate, y: coordinate });
const camera = fc.record({
  x: coordinate,
  y: coordinate,
  zoom: fc.double({ min: MIN_ZOOM, max: MAX_ZOOM, noNaN: true }),
});

function isClose(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) <= TOLERANCE && Math.abs(a.y - b.y) <= TOLERANCE;
}

describe('camera properties', () => {
  it('screenToWorld(worldToScreen(p)) returns p within 1e-9 at any zoom', () => {
    fc.assert(
      fc.property(camera, point, (cam: Camera, world: Point) =>
        isClose(screenToWorld(cam, worldToScreen(cam, world)), world),
      ),
    );
  });

  it('zoomAt keeps the world point under the anchor fixed', () => {
    const screenPoint = fc.record({
      x: fc.double({ min: 0, max: 8000, noNaN: true }),
      y: fc.double({ min: 0, max: 8000, noNaN: true }),
    });
    const factor = fc.double({ min: 0.01, max: 100, noNaN: true });
    fc.assert(
      fc.property(camera, screenPoint, factor, (cam: Camera, anchor: Point, f: number) =>
        isClose(screenToWorld(zoomAt(cam, anchor, f), anchor), screenToWorld(cam, anchor)),
      ),
    );
  });
});
