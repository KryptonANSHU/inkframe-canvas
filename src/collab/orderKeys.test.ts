import { describe, expect, it } from 'vitest';
import { assignKeys, compareOrder, keyBetween, keysBetween } from './orderKeys';

describe('order keys', () => {
  it('finds a key between any two, and past either end', () => {
    expect(keyBetween(null, null)).toBe('V');
    const low = keyBetween(null, 'V');
    const high = keyBetween('V', null);
    expect(low < 'V' && 'V' < high).toBe(true);
    const tight = keyBetween('V', 'W');
    expect('V' < tight && tight < 'W').toBe(true);
    expect(() => keyBetween('W', 'V')).toThrow();
  });

  it('spreads many keys evenly, keeping them short', () => {
    const keys = keysBetween(null, null, 100);
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(100);
    expect(Math.max(...keys.map((key) => key.length))).toBeLessThanOrEqual(3);
  });

  it('orders tied keys by ID, the same on every client', () => {
    expect(compareOrder({ key: 'V', id: 'b' }, { key: 'V', id: 'a' })).toBeGreaterThan(0);
  });
});

describe('assignKeys', () => {
  const sorted = (order: string[], keys: Map<string, string>) =>
    order
      .map((id) => keys.get(id) ?? '')
      .every((key, i, all) => i === 0 || (all[i - 1] ?? '') < key);

  it('keys new shapes between their neighbors and leaves the rest alone', () => {
    const current = new Map([
      ['a', 'A'],
      ['b', 'M'],
    ]);
    const changes = assignKeys(['a', 'new', 'b', 'top'], current);
    expect([...changes.keys()].sort()).toEqual(['new', 'top']);
    expect(sorted(['a', 'new', 'b', 'top'], new Map([...current, ...changes]))).toBe(true);
  });

  it('moves only the shapes that moved', () => {
    const current = new Map([
      ['a', 'A'],
      ['b', 'B'],
      ['c', 'C'],
      ['d', 'D'],
    ]);
    // Bring a to the front.
    const changes = assignKeys(['b', 'c', 'd', 'a'], current);
    expect([...changes.keys()]).toEqual(['a']);
    expect(sorted(['b', 'c', 'd', 'a'], new Map([...current, ...changes]))).toBe(true);
  });

  it('separates tied keys', () => {
    const current = new Map([
      ['a', 'V'],
      ['b', 'V'],
    ]);
    const changes = assignKeys(['a', 'b'], current);
    expect(sorted(['a', 'b'], new Map([...current, ...changes]))).toBe(true);
  });
});
