import { describe, expect, it } from 'vitest';
import {
  arrowHeadLength,
  inkMargin,
  isFilled,
  pathWorldPoints,
  shapeBounds,
  shapeBox,
  shapeGeometryBounds,
} from './shapeGeometry';
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

describe('shapeGeometryBounds', () => {
  it('is exact for a rotated ellipse, tighter than its rotated box', () => {
    const ellipse = makeEllipse({ x: 0, y: 0, width: 200, height: 40, rotation: Math.PI / 4 });
    const bounds = shapeGeometryBounds(ellipse);
    let maxX = -Infinity;
    for (let i = 0; i < 100_000; i++) {
      const t = (i / 100_000) * Math.PI * 2;
      const lx = 100 * Math.cos(t);
      const ly = 20 * Math.sin(t);
      maxX = Math.max(maxX, 100 + lx * Math.cos(Math.PI / 4) - ly * Math.sin(Math.PI / 4));
    }
    expect(bounds.maxX).toBeCloseTo(maxX, 3);
    expect(bounds.maxX).toBeLessThan(shapeBounds(ellipse).maxX - 2);
  });

  it('uses the rotated points of a path, not its box', () => {
    const line = makeLine({
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      rotation: Math.PI / 2,
    });
    const bounds = shapeGeometryBounds(line);
    expect(bounds.minX).toBeCloseTo(50, 9);
    expect(bounds.maxX).toBeCloseTo(50, 9);
    expect(bounds.maxY - bounds.minY).toBeCloseTo(100, 9);
  });

  it('gives an empty path a point at its position', () => {
    expect(shapeGeometryBounds(makePen({ x: 3, y: 4, points: [] }))).toEqual({
      minX: 3,
      minY: 4,
      maxX: 3,
      maxY: 4,
    });
  });

  it('is the rotated box for rectangles and text', () => {
    expect(shapeGeometryBounds(makeRect())).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 50 });
    expect(shapeGeometryBounds(makeText()).maxX).toBe(240);
  });
});

describe('pathWorldPoints', () => {
  it('applies position and rotation to every point', () => {
    const points = pathWorldPoints(
      makeLine({
        x: 10,
        y: 10,
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
        ],
        rotation: Math.PI,
      }),
    );
    expect(points[0]?.x).toBeCloseTo(30, 9);
    expect(points[1]?.x).toBeCloseTo(10, 9);
  });
});
