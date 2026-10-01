import { describe, expect, it } from 'vitest';
import { chooseBackingStoreSize, devicePixelRatioQuery, toBackingStoreSize } from './viewport';

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

describe('chooseBackingStoreSize', () => {
  it('uses the exact device-pixel size when it is within rounding of CSS × DPR', () => {
    const exact = { width: 1002, height: 416 };
    expect(chooseBackingStoreSize(801, 333, 1.25, exact)).toBe(exact);
  });

  it('falls back to CSS × DPR when the exact size disagrees with the DPR', () => {
    expect(chooseBackingStoreSize(1280, 720, 2, { width: 1280, height: 720 })).toEqual({
      width: 2560,
      height: 1440,
    });
  });

  it('falls back to CSS × DPR when the browser reports no exact size', () => {
    expect(chooseBackingStoreSize(100, 50, 3, undefined)).toEqual({ width: 300, height: 150 });
  });
});
