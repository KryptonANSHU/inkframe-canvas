import { describe, expect, it } from 'vitest';
import { EMPTY_DOCUMENT, insertShape } from './document';
import { HIT_TOLERANCE_PX, hitsShape, hitTest, hitTestAll, hitToleranceAt } from './hitTest';
import { arrowHeadWing } from './shapeGeometry';
import { DEFAULT_SHAPE_STYLE, type Shape } from './shapes';
import { createSpatialIndex } from './spatial/spatialIndex';
import {
  makeArrow,
  makeEllipse,
  makeLine,
  makePen,
  makeRect,
  makeText,
  testShapeId,
} from './testing/factories';

const filled = { ...DEFAULT_SHAPE_STYLE, fillColor: '#ff0000' };
// At zoom 1 with the default 2-unit stroke, a stroke is hit within 6 + 1 world units.
const tolerance = hitToleranceAt(1);
const reach = tolerance + DEFAULT_SHAPE_STYLE.strokeWidth / 2;

describe('hitToleranceAt', () => {
  it('is 6 screen pixels at every zoom', () => {
    expect(hitToleranceAt(1)).toBe(HIT_TOLERANCE_PX);
    expect(hitToleranceAt(2)).toBe(3);
    expect(hitToleranceAt(0.5)).toBe(12);
  });
});

describe('hitsShape: rectangle (0,0)–(100,50)', () => {
  const rect = makeRect();

  it('hits on the stroke and within reach of it', () => {
    expect(hitsShape(rect, { x: 50, y: 0 }, tolerance)).toBe(true);
    expect(hitsShape(rect, { x: 50, y: -reach }, tolerance)).toBe(true);
    // From inside, near the edge.
    expect(hitsShape(rect, { x: 50, y: reach - 0.01 }, tolerance)).toBe(true);
  });

  it('misses just beyond reach, and inside when unfilled', () => {
    expect(hitsShape(rect, { x: 50, y: -reach - 0.01 }, tolerance)).toBe(false);
    expect(hitsShape(rect, { x: 50, y: 25 }, tolerance)).toBe(false);
  });

  it('hits anywhere inside when filled', () => {
    expect(hitsShape(makeRect({ style: filled }), { x: 50, y: 25 }, tolerance)).toBe(true);
  });

  it('narrows the world-space reach as you zoom in', () => {
    const zoomedTolerance = hitToleranceAt(4);
    expect(hitsShape(rect, { x: 50, y: -2.4 }, zoomedTolerance)).toBe(true);
    expect(hitsShape(rect, { x: 50, y: -2.6 }, zoomedTolerance)).toBe(false);
  });

  it('tests a rotated rectangle in its own frame', () => {
    const rotated = makeRect({ rotation: Math.PI / 2, style: filled });
    // Rotated a quarter turn around (50, 25): now spans x 25–75, y −25–75.
    expect(hitsShape(rotated, { x: 50, y: -20 }, 0)).toBe(true);
    expect(hitsShape(rotated, { x: 5, y: 25 }, 0)).toBe(false);
  });
});

describe('hitsShape: ellipse in (0,0)–(100,50)', () => {
  it('hits the outline, misses the inside when unfilled', () => {
    const ellipse = makeEllipse();
    expect(hitsShape(ellipse, { x: 100, y: 25 }, tolerance)).toBe(true);
    expect(hitsShape(ellipse, { x: 50, y: 25 }, tolerance)).toBe(false);
    // A rectangle's corner is not part of the ellipse.
    expect(hitsShape(ellipse, { x: 2, y: 2 }, tolerance)).toBe(false);
  });

  it('hits the inside when filled', () => {
    expect(hitsShape(makeEllipse({ style: filled }), { x: 50, y: 25 }, tolerance)).toBe(true);
  });
});

describe('hitsShape: paths', () => {
  it('hits near a line, misses past its end', () => {
    const line = makeLine({
      x: 10,
      y: 10,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    });
    expect(hitsShape(line, { x: 60, y: 10 + reach - 0.01 }, tolerance)).toBe(true);
    expect(hitsShape(line, { x: 110 + reach + 0.01, y: 10 }, tolerance)).toBe(false);
  });

  it('never fills a path, even with a fill color', () => {
    const line = makeLine({ style: filled });
    expect(hitsShape(line, { x: 80, y: 10 }, tolerance)).toBe(false);
  });

  it('hits the tip of an arrowhead wing', () => {
    const arrow = makeArrow({
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
    });
    const tip = arrowHeadWing(arrow, 1, { x: 0, y: 0 });
    expect(hitsShape(arrow, tip, 0)).toBe(true);
    // The same point on a plain line is off the shaft.
    expect(hitsShape(makeLine({ points: arrow.points }), tip, 0)).toBe(false);
  });

  it('hits along every segment of a pen stroke', () => {
    const pen = makePen();
    expect(hitsShape(pen, { x: 20, y: 15 }, 0)).toBe(true);
    expect(hitsShape(pen, { x: 0, y: 40 }, tolerance)).toBe(false);
  });

  it('never hits an empty path', () => {
    expect(hitsShape(makePen({ points: [] }), { x: 0, y: 0 }, 100)).toBe(false);
  });
});

describe('hitsShape: text in (0,0)–(240,20)', () => {
  const text = makeText();

  it('hits anywhere in its box, and within the tolerance around it', () => {
    expect(hitsShape(text, { x: 120, y: 10 }, tolerance)).toBe(true);
    expect(hitsShape(text, { x: 120, y: 20 + tolerance }, tolerance)).toBe(true);
  });

  it('misses beyond the tolerance', () => {
    expect(hitsShape(text, { x: 120, y: 20 + tolerance + 0.01 }, tolerance)).toBe(false);
  });
});

describe('hitTest / hitTestAll', () => {
  const bottom = makeRect({ id: testShapeId('bottom'), style: filled, zIndex: 0 });
  const top = makeRect({ id: testShapeId('top'), x: 50, style: filled, zIndex: 1 });
  const away = makeRect({ id: testShapeId('away'), x: 1000, style: filled, zIndex: 2 });

  function setup(shapes: readonly Shape[]) {
    const document = shapes.reduce(insertShape, EMPTY_DOCUMENT);
    const index = createSpatialIndex();
    shapes.forEach((shape) => {
      index.update(shape);
    });
    return { document, index };
  }

  it('returns the topmost shape under the point', () => {
    const { document, index } = setup([bottom, top, away]);
    expect(hitTest(document, index, { x: 75, y: 25 }, 1)).toBe('top');
    expect(hitTest(document, index, { x: 25, y: 25 }, 1)).toBe('bottom');
    expect(hitTest(document, index, { x: 500, y: 500 }, 1)).toBeNull();
  });

  it('lists every hit, topmost first', () => {
    const { document, index } = setup([bottom, top, away]);
    expect(hitTestAll(document, index, { x: 75, y: 25 }, 1)).toEqual(['top', 'bottom']);
  });

  it('ignores index entries the document no longer has', () => {
    const { index } = setup([bottom]);
    expect(hitTest(EMPTY_DOCUMENT, index, { x: 25, y: 25 }, 1)).toBeNull();
    expect(hitTestAll(EMPTY_DOCUMENT, index, { x: 25, y: 25 }, 1)).toEqual([]);
  });
});
