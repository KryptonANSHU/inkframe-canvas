import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  distanceToEllipse,
  distanceToRectOutline,
  distanceToSegment,
  isInsideEllipse,
} from './distance';

/** Reference answer: the closest of 20,000 points sampled along the outline. */
function sampledEllipseDistance(px: number, py: number, a: number, b: number): number {
  let best = Infinity;
  const samples = 20_000;
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * Math.PI * 2;
    best = Math.min(best, Math.hypot(a * Math.cos(t) - px, b * Math.sin(t) - py));
  }
  return best;
}

describe('distanceToSegment', () => {
  it('measures to the nearest point on the segment, clamped to its ends', () => {
    expect(distanceToSegment(5, 3, 0, 0, 10, 0)).toBe(3);
    expect(distanceToSegment(13, 4, 0, 0, 10, 0)).toBe(5);
    expect(distanceToSegment(-3, -4, 0, 0, 10, 0)).toBe(5);
  });

  it('treats a zero-length segment as a point', () => {
    expect(distanceToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});

describe('distanceToRectOutline', () => {
  it('measures to the nearest edge from inside', () => {
    expect(distanceToRectOutline(0, 0, 50, 20)).toBe(20);
    expect(distanceToRectOutline(45, 0, 50, 20)).toBe(5);
  });

  it('measures to the nearest edge or corner from outside', () => {
    expect(distanceToRectOutline(60, 0, 50, 20)).toBe(10);
    expect(distanceToRectOutline(53, 24, 50, 20)).toBe(5);
  });
});

describe('isInsideEllipse', () => {
  it('includes the outline and excludes points beyond it', () => {
    expect(isInsideEllipse(50, 0, 50, 20)).toBe(true);
    expect(isInsideEllipse(40, 15, 50, 20)).toBe(false);
    expect(isInsideEllipse(0, 0, 0, 20)).toBe(false);
  });
});

describe('distanceToEllipse', () => {
  it('is exact on a circle', () => {
    expect(distanceToEllipse(0, 0, 10, 10)).toBeCloseTo(10, 9);
    expect(distanceToEllipse(30, 40, 10, 10)).toBeCloseTo(40, 9);
  });

  it('is zero on the outline and symmetric in every quadrant', () => {
    expect(distanceToEllipse(50, 0, 50, 20)).toBeCloseTo(0, 9);
    expect(distanceToEllipse(-12, 7, 50, 20)).toBe(distanceToEllipse(12, -7, 50, 20));
  });

  it('handles a flat ellipse as a segment', () => {
    expect(distanceToEllipse(5, 3, 10, 0)).toBe(3);
    // Beyond the end of the flat ellipse: nearest point is the tip at (0, 10).
    expect(distanceToEllipse(3, 15, 0, 10)).toBe(Math.hypot(3, 5));
  });

  it('matches dense outline sampling within 0.1% of the larger radius', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: -2, max: 2, noNaN: true }),
        fc.double({ min: -2, max: 2, noNaN: true }),
        (a, b, u, v) => {
          const px = u * a;
          const py = v * b;
          const error = Math.abs(
            distanceToEllipse(px, py, a, b) - sampledEllipseDistance(px, py, a, b),
          );
          // Sampling itself is only accurate to about (2π·max / 20,000)² / max.
          return error <= Math.max(a, b) * 1e-3;
        },
      ),
      { numRuns: 300 },
    );
  });
});
