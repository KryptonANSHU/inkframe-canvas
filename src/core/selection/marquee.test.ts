import { describe, expect, it } from 'vitest';
import { EMPTY_DOCUMENT, insertShape } from '../document';
import type { Shape } from '../shapes';
import { createSpatialIndex } from '../spatial/spatialIndex';
import {
  makeEllipse,
  makeLine,
  makePen,
  makeRect,
  makeText,
  testShapeId,
} from '../testing/factories';
import { shapesInMarquee, shapeTouchesBounds } from './marquee';

function setup(shapes: readonly Shape[]) {
  const document = shapes.reduce(insertShape, EMPTY_DOCUMENT);
  const index = createSpatialIndex();
  shapes.forEach((shape) => {
    index.update(shape);
  });
  return { document, index };
}

const area = (minX: number, minY: number, maxX: number, maxY: number) => ({
  minX,
  minY,
  maxX,
  maxY,
});

describe('shapesInMarquee', () => {
  const small = makeRect({
    id: testShapeId('small'),
    x: 10,
    y: 10,
    width: 20,
    height: 20,
    zIndex: 0,
  });
  const big = makeRect({ id: testShapeId('big'), x: 0, y: 0, width: 300, height: 300, zIndex: 1 });

  it('selects only shapes fully inside by default, bottom to top', () => {
    const { document, index } = setup([small, big]);
    expect(shapesInMarquee(document, index, area(0, 0, 50, 50), 'inside')).toEqual(['small']);
    expect(shapesInMarquee(document, index, area(-1, -1, 301, 301), 'inside')).toEqual([
      'small',
      'big',
    ]);
  });

  it('selects every shape it touches in touching mode', () => {
    const { document, index } = setup([small, big]);
    expect(shapesInMarquee(document, index, area(0, 0, 50, 50), 'touching')).toEqual([
      'small',
      'big',
    ]);
  });

  it('counts a rotated ellipse as inside when the ellipse is, even if its box is not', () => {
    const ellipse = makeEllipse({ x: 0, y: 0, width: 200, height: 40, rotation: Math.PI / 4 });
    const { document, index } = setup([ellipse]);
    // The ellipse's rotated box reaches ~127 from the center; the ellipse itself ~72.
    expect(
      shapesInMarquee(document, index, area(100 - 75, 20 - 75, 100 + 75, 20 + 75), 'inside'),
    ).toEqual(['ellipse']);
  });
});

describe('shapeTouchesBounds', () => {
  it('follows the line itself, not its bounding box', () => {
    const diagonal = makeLine({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
    });
    expect(shapeTouchesBounds(diagonal, area(80, 0, 100, 20))).toBe(false);
    expect(shapeTouchesBounds(diagonal, area(40, 40, 60, 60))).toBe(true);
  });

  it('follows a rotated rectangle, not its axis-aligned box', () => {
    const rotated = makeRect({ x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 4 });
    // The corner region of the axis-aligned box is empty once the square is turned 45°.
    expect(shapeTouchesBounds(rotated, area(-19, -19, -16, -16))).toBe(false);
    expect(shapeTouchesBounds(rotated, area(45, 45, 55, 55))).toBe(true);
  });

  it('misses an ellipse from its box corner, hits it on its side', () => {
    const ellipse = makeEllipse({ x: 0, y: 0, width: 100, height: 100 });
    expect(shapeTouchesBounds(ellipse, area(0, 0, 5, 5))).toBe(false);
    expect(shapeTouchesBounds(ellipse, area(98, 45, 110, 55))).toBe(true);
  });

  it('handles text, pen strokes, single points, and empty paths', () => {
    expect(shapeTouchesBounds(makeText(), area(200, 5, 210, 10))).toBe(true);
    expect(shapeTouchesBounds(makePen(), area(18, 13, 22, 17))).toBe(true);
    expect(shapeTouchesBounds(makePen({ points: [{ x: 5, y: 5 }] }), area(0, 0, 10, 10))).toBe(
      true,
    );
    expect(shapeTouchesBounds(makePen({ points: [] }), area(-100, -100, 100, 100))).toBe(false);
  });
});
