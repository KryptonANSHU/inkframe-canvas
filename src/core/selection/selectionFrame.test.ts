import { describe, expect, it } from 'vitest';
import { makeEllipse, makeRect, testShapeId } from '../testing/factories';
import { frameContains, selectionFrame } from './selectionFrame';

describe('selectionFrame', () => {
  it('is empty without shapes', () => {
    expect(selectionFrame([])).toBeNull();
  });

  it('follows a single shape, rotation included', () => {
    expect(
      selectionFrame([makeRect({ x: 10, y: 20, width: 100, height: 50, rotation: 1 })]),
    ).toEqual({
      centerX: 60,
      centerY: 45,
      width: 100,
      height: 50,
      rotation: 1,
    });
  });

  it('is axis-aligned around several shapes', () => {
    const frame = selectionFrame([
      makeRect({ id: testShapeId('a'), x: 0, y: 0, width: 10, height: 10 }),
      makeEllipse({ id: testShapeId('b'), x: 90, y: 40, width: 10, height: 10 }),
    ]);
    expect(frame).toEqual({ centerX: 50, centerY: 25, width: 100, height: 50, rotation: 0 });
  });
});

describe('frameContains', () => {
  const frame = { centerX: 0, centerY: 0, width: 100, height: 20, rotation: Math.PI / 2 };

  it('tests in the rotated frame, with a margin', () => {
    expect(frameContains(frame, { x: 0, y: 45 }, 0)).toBe(true);
    expect(frameContains(frame, { x: 45, y: 0 }, 0)).toBe(false);
    expect(frameContains(frame, { x: 12, y: 0 }, 3)).toBe(true);
  });
});
