import { describe, expect, it } from 'vitest';
import { makeLine, makeRect, testShapeId } from '../testing/factories';
import { endpointsOf } from '../testing/geometry';
import { moveEndpoint } from './endpoints';
import { ROTATION_SNAP, rotateShapes, snappedDelta } from './rotate';

describe('rotateShapes', () => {
  it('turns a shape around its own center when that is the pivot', () => {
    const [turned] = rotateShapes(
      [makeRect({ x: 0, y: 0, width: 100, height: 50 })],
      50,
      25,
      Math.PI / 2,
    );
    expect(turned).toMatchObject({ x: 0, y: 0, rotation: Math.PI / 2 });
  });

  it('orbits group members around the group center and normalizes angles', () => {
    const a = makeRect({
      id: testShapeId('a'),
      x: -10,
      y: -10,
      width: 20,
      height: 20,
      rotation: 0,
    });
    const b = makeRect({
      id: testShapeId('b'),
      x: 90,
      y: -10,
      width: 20,
      height: 20,
      rotation: (3 * Math.PI) / 2,
    });
    const [a2, b2] = rotateShapes([a, b], 50, 0, Math.PI);
    expect(a2?.x).toBeCloseTo(90, 9);
    expect(b2?.x).toBeCloseTo(-10, 9);
    expect(b2?.rotation).toBeCloseTo(Math.PI / 2, 12);
  });
});

describe('snappedDelta', () => {
  it('snaps a single shape to absolute 15° steps', () => {
    const shape = makeRect({ rotation: 0.1 });
    expect(shape.rotation + snappedDelta([shape], 0.2, true)).toBeCloseTo(ROTATION_SNAP, 12);
  });

  it('snaps a group by the turn itself, and does nothing without Shift', () => {
    const shapes = [
      makeRect({ id: testShapeId('a') }),
      makeRect({ id: testShapeId('b'), rotation: 0.1 }),
    ];
    expect(snappedDelta(shapes, 0.3, true)).toBeCloseTo(ROTATION_SNAP, 12);
    expect(snappedDelta(shapes, 0.3, false)).toBe(0.3);
  });
});

describe('moveEndpoint', () => {
  const line = makeLine({
    x: 0,
    y: 0,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
  });

  it('moves one end and keeps the other where it was', () => {
    expect(endpointsOf(moveEndpoint(line, 'end', { x: 100, y: 100 }))).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(endpointsOf(moveEndpoint(line, 'start', { x: -50, y: 20 }))).toEqual([
      { x: -50, y: 20 },
      { x: 100, y: 0 },
    ]);
  });

  it('keeps the far end of a rotated line fixed and returns an unrotated shape', () => {
    const rotated = { ...line, rotation: Math.PI / 2 };
    const moved = moveEndpoint(rotated, 'end', { x: 200, y: 0 });
    const [start] = endpointsOf(moved);
    expect(moved.rotation).toBe(0);
    expect(start?.x).toBeCloseTo(50, 9);
    expect(start?.y).toBeCloseTo(-50, 9);
  });
});
