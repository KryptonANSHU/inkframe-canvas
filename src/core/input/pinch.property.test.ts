import fc from 'fast-check';
import { describe, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, screenToWorld, worldToScreen } from '../camera';
import { distance } from '../geometry/point';
import { pinchCamera } from './pinch';

// Finger positions on a large screen, and a camera anywhere in a large world.
const screenCoordinate = fc.double({ min: 0, max: 4000, noNaN: true });
const finger = fc.record({ x: screenCoordinate, y: screenCoordinate });
const worldCoordinate = fc.double({ min: -1e5, max: 1e5, noNaN: true });
const camera = fc.record({
  x: worldCoordinate,
  y: worldCoordinate,
  zoom: fc.double({ min: MIN_ZOOM, max: MAX_ZOOM, noNaN: true }),
});
/** Screen pixels; well under what a user could see. */
const TOLERANCE = 1e-6;
/** Fingers closer than this are one touch, as far as zoom is concerned. */
const MIN_SPAN = 1;

describe('pinch properties', () => {
  it('keeps the world point that was between the fingers between them', () => {
    fc.assert(
      fc.property(camera, finger, finger, finger, finger, (start, a, b, c, d) => {
        fc.pre(distance(a, b) >= MIN_SPAN);
        const pinched = pinchCamera(start, [a, b], [c, d]);
        const held = screenToWorld(start, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        const now = worldToScreen(pinched, held);
        // Holds even when zoom hits a limit: zoomAt anchors at the clamped zoom.
        return (
          Math.abs(now.x - (c.x + d.x) / 2) <= TOLERANCE &&
          Math.abs(now.y - (c.y + d.y) / 2) <= TOLERANCE
        );
      }),
    );
  });
});
