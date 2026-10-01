import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMERA, MAX_ZOOM, screenToWorld } from '../camera';
import { applyWheel, wheelDeltaToPixels, type WheelInput } from './wheel';

const anchor = { x: 400, y: 300 };

function wheel(overrides: Partial<WheelInput>): WheelInput {
  return { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, pageHeight: 800, ...overrides };
}

describe('wheelDeltaToPixels', () => {
  it.each([
    [0, 5, 5],
    [1, 3, 48],
    [2, 1, 800],
  ])('converts deltaMode %s: %s → %s px', (deltaMode, delta, pixels) => {
    expect(wheelDeltaToPixels(delta, deltaMode, 800)).toBe(pixels);
  });
});

describe('applyWheel', () => {
  it('pans the content opposite to the scroll direction', () => {
    const camera = applyWheel(DEFAULT_CAMERA, wheel({ deltaX: 30, deltaY: 50 }), anchor);
    expect(camera).toEqual({ x: 30, y: 50, zoom: 1 });
  });

  it('zooms in on Ctrl + wheel up, keeping the point under the cursor fixed', () => {
    const camera = applyWheel(DEFAULT_CAMERA, wheel({ deltaY: -5, ctrlKey: true }), anchor);
    expect(camera.zoom).toBeCloseTo(Math.exp(0.05), 12);
    const before = screenToWorld(DEFAULT_CAMERA, anchor);
    const after = screenToWorld(camera, anchor);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it('caps one mouse-wheel notch at about 10% zoom', () => {
    const camera = applyWheel(DEFAULT_CAMERA, wheel({ deltaY: 100, ctrlKey: true }), anchor);
    expect(camera.zoom).toBeCloseTo(Math.exp(-0.1), 12);
  });

  it('never zooms past the clamp', () => {
    let camera = DEFAULT_CAMERA;
    for (let i = 0; i < 100; i++) {
      camera = applyWheel(camera, wheel({ deltaY: -100, ctrlKey: true }), anchor);
    }
    expect(camera.zoom).toBe(MAX_ZOOM);
  });
});
