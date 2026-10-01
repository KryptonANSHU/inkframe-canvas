import { describe, expect, it } from 'vitest';
import { simplifyPath } from './simplify';

describe('simplifyPath', () => {
  it('leaves paths within the limit alone', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(simplifyPath(points, 2)).toEqual(points);
  });

  it('drops points on straight stretches first, keeping both ends and the corner', () => {
    const line = Array.from({ length: 101 }, (_, i) => ({ x: i, y: 0 }));
    const corner = Array.from({ length: 100 }, (_, i) => ({ x: 100, y: i + 1 }));
    expect(simplifyPath([...line, ...corner], 3)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('always fits the limit, even for noise with no flat parts', () => {
    const noise = Array.from({ length: 200_000 }, (_, i) => ({ x: i, y: (i * 7919) % 1000 }));
    const simplified = simplifyPath(noise, 1_000);
    expect(simplified.length).toBeLessThanOrEqual(1_000);
    expect(simplified[0]).toEqual(noise[0]);
    expect(simplified.at(-1)).toEqual(noise.at(-1));
  });
});
