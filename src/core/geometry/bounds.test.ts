import { describe, expect, it } from 'vitest';
import {
  boundsAround,
  boundsIntersect,
  inflateBox,
  isFiniteBounds,
  rotatedBoxBounds,
} from './bounds';

const box = { x: 10, y: 20, width: 40, height: 20 };

describe('rotatedBoxBounds', () => {
  it('equals the box when not rotated', () => {
    expect(rotatedBoxBounds(box, 0)).toEqual({ minX: 10, minY: 20, maxX: 50, maxY: 40 });
  });

  it('swaps width and height at a quarter turn, around the center', () => {
    const bounds = rotatedBoxBounds(box, Math.PI / 2);
    expect(bounds.minX).toBeCloseTo(20, 12);
    expect(bounds.maxX).toBeCloseTo(40, 12);
    expect(bounds.minY).toBeCloseTo(10, 12);
    expect(bounds.maxY).toBeCloseTo(50, 12);
  });

  it('grows a square by √2 at 45°', () => {
    const bounds = rotatedBoxBounds({ x: -1, y: -1, width: 2, height: 2 }, Math.PI / 4);
    expect(bounds.maxX).toBeCloseTo(Math.SQRT2, 12);
    expect(bounds.minY).toBeCloseTo(-Math.SQRT2, 12);
  });
});

describe('box and bounds helpers', () => {
  it('inflates a box on every side', () => {
    expect(inflateBox(box, 5)).toEqual({ x: 5, y: 15, width: 50, height: 30 });
  });

  it('treats touching edges as intersecting', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    expect(boundsIntersect(a, boundsAround(15, 5, 5))).toBe(true);
    expect(boundsIntersect(a, boundsAround(16, 5, 5))).toBe(false);
    expect(boundsIntersect(a, boundsAround(5, -6, 5))).toBe(false);
  });

  it('detects non-finite bounds', () => {
    expect(isFiniteBounds(boundsAround(0, 0, 1))).toBe(true);
    expect(isFiniteBounds(boundsAround(Number.NaN, 0, 1))).toBe(false);
  });
});
