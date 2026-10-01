import { describe, expect, it } from 'vitest';
import { isOddQuarterTurn, isRightAngleMultiple, normalizeAngle, snapAngle } from './angles';

describe('angles', () => {
  it('normalizes to [0, 2π)', () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(normalizeAngle(5 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(normalizeAngle(2 * Math.PI)).toBe(0);
    expect(normalizeAngle(-1e-18)).toBeLessThan(2 * Math.PI);
  });

  it('snaps to the nearest step', () => {
    expect(snapAngle(0.3, Math.PI / 12)).toBeCloseTo(Math.PI / 12, 12);
  });

  it('recognizes quarter turns, odd and even', () => {
    expect(isRightAngleMultiple(Math.PI * 1.5)).toBe(true);
    expect(isRightAngleMultiple(0.3)).toBe(false);
    expect(isOddQuarterTurn(Math.PI / 2)).toBe(true);
    expect(isOddQuarterTurn(-Math.PI / 2)).toBe(true);
    expect(isOddQuarterTurn(Math.PI)).toBe(false);
  });
});
