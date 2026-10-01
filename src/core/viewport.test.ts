import { describe, expect, it } from 'vitest';
import { devicePixelRatioQuery, toBackingStoreSize } from './viewport';

describe('toBackingStoreSize', () => {
  it.each([1, 2, 3])('multiplies the CSS size by an integer DPR of %s', (dpr) => {
    expect(toBackingStoreSize(800, 600, dpr)).toEqual({ width: 800 * dpr, height: 600 * dpr });
  });

  it('rounds fractional results to whole device pixels', () => {
    expect(toBackingStoreSize(801, 333, 1.25)).toEqual({ width: 1001, height: 416 });
  });

  it('allows an empty canvas', () => {
    expect(toBackingStoreSize(0, 0, 2)).toEqual({ width: 0, height: 0 });
  });
});

describe('devicePixelRatioQuery', () => {
  it('builds a resolution media query for the current DPR', () => {
    expect(devicePixelRatioQuery(1.5)).toBe('(resolution: 1.5dppx)');
  });
});
