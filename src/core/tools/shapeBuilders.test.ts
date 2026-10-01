import { describe, expect, it } from 'vitest';
import { testShapeId } from '../testing/factories';
import { arrowBetween, ellipseBetween, lineBetween, rectangleBetween } from './shapeBuilders';

const id = testShapeId('built');

describe('box builders', () => {
  it.each([
    ['rectangle', rectangleBetween],
    ['ellipse', ellipseBetween],
  ] as const)('%s: spans the drag in any direction, at least 1 unit each way', (type, build) => {
    expect(build(id, { x: 200, y: 200 }, { x: 100, y: 120 })).toMatchObject({
      type,
      x: 100,
      y: 120,
      width: 100,
      height: 80,
    });
    expect(build(id, { x: 0, y: 0 }, { x: 0.2, y: 0 })).toMatchObject({ width: 1, height: 1 });
  });
});

describe('path builders', () => {
  it.each([
    ['line', lineBetween],
    ['arrow', arrowBetween],
  ] as const)(
    '%s: keeps the drag direction with points relative to the top-left',
    (type, build) => {
      expect(build(id, { x: 300, y: 100 }, { x: 100, y: 150 })).toMatchObject({
        type,
        x: 100,
        y: 100,
        points: [
          { x: 200, y: 0 },
          { x: 0, y: 50 },
        ],
      });
    },
  );

  it('stretches a drag shorter than 1 unit to 1 unit along its direction', () => {
    const shape = arrowBetween(id, { x: 0, y: 0 }, { x: 0, y: -0.5 });
    if (shape.type !== 'arrow') throw new Error('expected an arrow');
    const [start, end] = shape.points;
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(1, 12);
    expect(end.y).toBeLessThan(start.y);
  });

  it('points a zero-length drag to the right, 1 unit long', () => {
    const shape = lineBetween(id, { x: 5, y: 5 }, { x: 5, y: 5 });
    expect(shape).toMatchObject({
      x: 5,
      y: 5,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });
  });
});
