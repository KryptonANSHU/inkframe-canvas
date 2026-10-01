import { describe, expect, it } from 'vitest';
import { arrowHeadLength, inkMargin, isFilled, shapeBounds, shapeBox } from './shapeGeometry';
import { DEFAULT_SHAPE_STYLE } from './shapes';
import { makeArrow, makeEllipse, makeLine, makePen, makeRect, makeText } from './testing/factories';

const filled = { ...DEFAULT_SHAPE_STYLE, fillColor: '#ff0000' };

describe('shapeBox', () => {
  it('is the shape itself for rectangles, ellipses, and text', () => {
    for (const shape of [makeRect(), makeEllipse(), makeText()]) {
      expect(shapeBox(shape)).toBe(shape);
    }
  });

  it('spans the points of a path, offset by its position', () => {
    const line = makeLine({
      x: 100,
      y: 50,
      points: [
        { x: 30, y: 40 },
        { x: 10, y: 0 },
      ],
    });
    expect(shapeBox(line)).toEqual({ x: 110, y: 50, width: 20, height: 40 });
  });

  it('computes a path box once per shape object', () => {
    const pen = makePen();
    expect(shapeBox(pen)).toBe(shapeBox(pen));
  });

  it('gives an empty path a zero-size box at its position', () => {
    expect(shapeBox(makePen({ x: 5, y: 6, points: [] }))).toEqual({
      x: 5,
      y: 6,
      width: 0,
      height: 0,
    });
  });
});

describe('isFilled', () => {
  it('is true only for rectangles and ellipses with a fill color', () => {
    expect(isFilled(makeRect({ style: filled }))).toBe(true);
    expect(isFilled(makeEllipse({ style: filled }))).toBe(true);
    expect(isFilled(makeRect())).toBe(false);
    expect(isFilled(makeLine({ style: filled }))).toBe(false);
    expect(isFilled(makeText({ style: filled }))).toBe(false);
  });
});

describe('arrows', () => {
  it('grows the head with stroke width, up to half the shaft', () => {
    const long = makeArrow({
      points: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
      ],
    });
    expect(arrowHeadLength(long)).toBe(8 + 2 * 3);
    const short = makeArrow({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    });
    expect(arrowHeadLength(short)).toBe(5);
  });

  it('adds the head length to the ink margin', () => {
    const arrow = makeArrow();
    expect(inkMargin(arrow)).toBe(2 + arrowHeadLength(arrow));
  });
});

describe('shapeBounds', () => {
  it('covers the box plus a full stroke width', () => {
    expect(shapeBounds(makeRect({ x: 0, y: 0, width: 100, height: 50 }))).toEqual({
      minX: -2,
      minY: -2,
      maxX: 102,
      maxY: 52,
    });
  });

  it('gives a horizontal line height from its stroke', () => {
    const bounds = shapeBounds(
      makeLine({
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      }),
    );
    expect(bounds.maxY - bounds.minY).toBe(4);
  });

  it('includes rotation', () => {
    const bounds = shapeBounds(makeRect({ width: 100, height: 10, rotation: Math.PI / 2 }));
    expect(bounds.maxY - bounds.minY).toBeCloseTo(104, 9);
  });
});
