import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  screenToWorld,
  worldToDeviceTransform,
  worldToScreen,
  zoomAt,
  type Camera,
} from './camera';
import { createPoint } from './geometry/point';

const camera: Camera = { x: 100, y: -50, zoom: 2 };

describe('worldToScreen / screenToWorld', () => {
  it('maps the camera position to the screen origin', () => {
    expect(worldToScreen(camera, { x: 100, y: -50 })).toEqual({ x: 0, y: 0 });
  });

  it('scales world distances by zoom', () => {
    expect(worldToScreen(camera, { x: 110, y: -40 })).toEqual({ x: 20, y: 20 });
    expect(screenToWorld(camera, { x: 20, y: 20 })).toEqual({ x: 110, y: -40 });
  });

  it('writes into the out point instead of allocating', () => {
    const out = createPoint();
    expect(worldToScreen(camera, { x: 0, y: 0 }, out)).toBe(out);
    expect(screenToWorld(camera, { x: 0, y: 0 }, out)).toBe(out);
  });
});

describe('zoomAt', () => {
  const anchor = { x: 300, y: 200 };

  it('keeps the world point under the anchor fixed', () => {
    const before = screenToWorld(camera, anchor);
    const zoomed = zoomAt(camera, anchor, 1.5);
    expect(zoomed.zoom).toBe(3);
    expect(screenToWorld(zoomed, anchor)).toEqual(before);
  });

  it('clamps zoom to the 10%–400% range', () => {
    expect(zoomAt(DEFAULT_CAMERA, anchor, 100).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(DEFAULT_CAMERA, anchor, 0.001).zoom).toBe(MIN_ZOOM);
  });

  it('keeps the anchor fixed when the zoom is clamped', () => {
    const before = screenToWorld(DEFAULT_CAMERA, anchor);
    const zoomed = zoomAt(DEFAULT_CAMERA, anchor, 100);
    expect(screenToWorld(zoomed, anchor)).toEqual(before);
  });

  it('returns the same camera when the zoom cannot change', () => {
    const maxed: Camera = { x: 0, y: 0, zoom: MAX_ZOOM };
    expect(zoomAt(maxed, anchor, 2)).toBe(maxed);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('ignores a factor of %s', (factor) => {
    expect(zoomAt(camera, anchor, factor)).toBe(camera);
  });
});

describe('panBy', () => {
  it('moves the content by screen pixels at any zoom', () => {
    const world = { x: 120, y: 0 };
    const before = worldToScreen(camera, world);
    const after = worldToScreen(panBy(camera, 30, -10), world);
    expect(after).toEqual({ x: before.x + 30, y: before.y - 10 });
  });
});

describe('worldToDeviceTransform', () => {
  it('equals worldToScreen scaled by devicePixelRatio', () => {
    const world = { x: 137, y: -12 };
    const t = worldToDeviceTransform(camera, 3);
    const screen = worldToScreen(camera, world);
    expect(t.a * world.x + t.c * world.y + t.e).toBe(screen.x * 3);
    expect(t.b * world.x + t.d * world.y + t.f).toBe(screen.y * 3);
  });
});
