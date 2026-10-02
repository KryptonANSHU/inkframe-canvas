import { describe, expect, it } from 'vitest';
import { listWindow } from './listWindow';

describe('listWindow', () => {
  it('centers the active item, clamped to both ends', () => {
    expect(listWindow(10_000, 5_000, 50)).toEqual({ start: 4_975, end: 5_025 });
    expect(listWindow(10_000, 3, 50)).toEqual({ start: 0, end: 50 });
    expect(listWindow(10_000, 9_999, 50)).toEqual({ start: 9_950, end: 10_000 });
  });

  it('renders everything when the list is short', () => {
    expect(listWindow(7, 4, 50)).toEqual({ start: 0, end: 7 });
    expect(listWindow(0, 0, 50)).toEqual({ start: 0, end: 0 });
  });
});
