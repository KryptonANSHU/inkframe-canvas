import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { rotatedBoxCorners, toLocalPoint, toWorldPoint } from './transform';

describe('toLocalPoint / toWorldPoint', () => {
  it('are inverses at any rotation', () => {
    const value = fc.double({ min: -1e4, max: 1e4, noNaN: true });
    fc.assert(
      fc.property(
        value,
        value,
        value,
        value,
        fc.double({ min: 0, max: 7, noNaN: true }),
        (x, y, cx, cy, r) => {
          const local = toLocalPoint({ x, y }, cx, cy, r, { x: 0, y: 0 });
          const back = toWorldPoint(local, cx, cy, r, { x: 0, y: 0 });
          return Math.abs(back.x - x) < 1e-8 && Math.abs(back.y - y) < 1e-8;
        },
      ),
    );
  });
});

describe('rotatedBoxCorners', () => {
  it('lists corners clockwise from the top-left, rotated around the center', () => {
    const corners = rotatedBoxCorners({ x: 0, y: 0, width: 4, height: 2 }, Math.PI / 2);
    const rounded = corners.map(({ x, y }) => ({
      x: Math.round(x * 1e9) / 1e9,
      y: Math.round(y * 1e9) / 1e9,
    }));
    expect(rounded).toEqual([
      { x: 3, y: -1 },
      { x: 3, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: -1 },
    ]);
  });
});
