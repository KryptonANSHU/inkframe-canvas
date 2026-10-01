import { describe, expect, it } from 'vitest';
import {
  boundsContain,
  boundsCorners,
  convexPolygonsIntersect,
  segmentIntersectsBounds,
} from './polygon';

const square = boundsCorners({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
const diamond = (cx: number, cy: number, r: number) => [
  { x: cx, y: cy - r },
  { x: cx + r, y: cy },
  { x: cx, y: cy + r },
  { x: cx - r, y: cy },
];

describe('convexPolygonsIntersect', () => {
  it('detects overlap, containment, and touching edges', () => {
    expect(convexPolygonsIntersect(square, diamond(5, 5, 2))).toBe(true);
    expect(convexPolygonsIntersect(square, diamond(5, 5, 100))).toBe(true);
    expect(convexPolygonsIntersect(square, diamond(15, 5, 5))).toBe(true);
  });

  it('separates a diamond sitting off the square corner, which bounding boxes would not', () => {
    // Its box overlaps the square's corner region, but the diamond itself does not.
    expect(convexPolygonsIntersect(square, diamond(14, 14, 7))).toBe(false);
  });
});

describe('segmentIntersectsBounds', () => {
  const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

  it('accepts segments that cross, end inside, or lie inside', () => {
    expect(segmentIntersectsBounds({ x: -5, y: 5 }, { x: 15, y: 5 }, bounds)).toBe(true);
    expect(segmentIntersectsBounds({ x: -5, y: -5 }, { x: 2, y: 2 }, bounds)).toBe(true);
    expect(segmentIntersectsBounds({ x: 2, y: 2 }, { x: 3, y: 3 }, bounds)).toBe(true);
  });

  it('rejects a diagonal that passes the corner, and parallel misses', () => {
    expect(segmentIntersectsBounds({ x: 8, y: 14 }, { x: 14, y: 8 }, bounds)).toBe(false);
    expect(segmentIntersectsBounds({ x: -5, y: 12 }, { x: 15, y: 12 }, bounds)).toBe(false);
  });
});

describe('boundsContain', () => {
  it('includes edges', () => {
    expect(
      boundsContain(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        { minX: 0, minY: 2, maxX: 10, maxY: 3 },
      ),
    ).toBe(true);
    expect(
      boundsContain(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        { minX: -1, minY: 2, maxX: 5, maxY: 3 },
      ),
    ).toBe(false);
  });
});
