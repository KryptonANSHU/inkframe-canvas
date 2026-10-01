import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMERA, MAX_ZOOM, screenToWorld, worldToScreen } from '../camera';
import { createTouchTracker, pinchCamera } from './pinch';

describe('pinchCamera', () => {
  it('zooms by the change in finger distance, keeping the content between them', () => {
    const start = [
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ] as const;
    const now = [
      { x: 50, y: 300 },
      { x: 250, y: 300 },
    ] as const;
    const camera = pinchCamera(DEFAULT_CAMERA, start, now);
    expect(camera.zoom).toBe(2);
    // The world point that was midway between the fingers is midway between them again.
    const held = screenToWorld(DEFAULT_CAMERA, { x: 150, y: 100 });
    expect(worldToScreen(camera, held)).toEqual({ x: 150, y: 300 });
  });

  it('only pans when the fingers keep their distance, and clamps zoom', () => {
    const start = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ] as const;
    expect(
      pinchCamera(DEFAULT_CAMERA, start, [
        { x: 5, y: 5 },
        { x: 15, y: 5 },
      ]),
    ).toEqual({ x: -5, y: -5, zoom: 1 });
    expect(
      pinchCamera(DEFAULT_CAMERA, start, [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ]).zoom,
    ).toBe(MAX_ZOOM);
  });

  it('keeps the zoom when both fingers started on the same point', () => {
    const point = { x: 3, y: 3 };
    expect(pinchCamera(DEFAULT_CAMERA, [point, point], [point, { x: 9, y: 3 }]).zoom).toBe(1);
  });
});

describe('touch tracker', () => {
  it('turns a second finger into a pinch that ends when either finger lifts', () => {
    const touches = createTouchTracker();
    expect(touches.down(1, { x: 0, y: 0 }, DEFAULT_CAMERA)).toBe('first');
    expect(touches.move(1, { x: 5, y: 0 })).toBeNull();
    expect(touches.down(2, { x: 15, y: 0 }, DEFAULT_CAMERA)).toBe('second');
    expect(touches.down(3, { x: 50, y: 50 }, DEFAULT_CAMERA)).toBe('extra');
    expect(touches.move(2, { x: 25, y: 0 })?.zoom).toBe(2);
    expect(touches.up(1)).toBe(true);
    expect(touches.pinching()).toBe(false);
    // The finger left behind no longer pinches, and its release is an ordinary one.
    expect(touches.move(2, { x: 30, y: 0 })).toBeNull();
    expect(touches.up(2)).toBe(false);
  });
});
