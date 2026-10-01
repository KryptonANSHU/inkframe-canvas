import {
  DEFAULT_SHAPE_STYLE,
  type ArrowShape,
  type EllipseShape,
  type LineShape,
  type PenShape,
  type RectShape,
  type ShapeId,
} from '../shapes';

/** Readable, deterministic IDs for tests. Real IDs come from createShapeId(). */
export function testShapeId(name: string): ShapeId {
  return name as ShapeId;
}

export function makeRect(overrides: Partial<Omit<RectShape, 'type'>> = {}): RectShape {
  return {
    id: testShapeId('rect'),
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    rotation: 0,
    style: DEFAULT_SHAPE_STYLE,
    zIndex: 0,
    ...overrides,
  };
}

export function makeEllipse(overrides: Partial<Omit<EllipseShape, 'type'>> = {}): EllipseShape {
  return { ...makeRect(), id: testShapeId('ellipse'), type: 'ellipse', ...overrides };
}

const pathDefaults = {
  x: 0,
  y: 0,
  rotation: 0,
  style: DEFAULT_SHAPE_STYLE,
  zIndex: 0,
};

export function makeLine(overrides: Partial<Omit<LineShape, 'type'>> = {}): LineShape {
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 50 },
  ] as const;
  return { ...pathDefaults, id: testShapeId('line'), type: 'line', points, ...overrides };
}

export function makeArrow(overrides: Partial<Omit<ArrowShape, 'type'>> = {}): ArrowShape {
  return { ...makeLine(), id: testShapeId('arrow'), type: 'arrow', ...overrides };
}

export function makePen(overrides: Partial<Omit<PenShape, 'type'>> = {}): PenShape {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 20 },
    { x: 30, y: 10 },
    { x: 40, y: 40 },
  ];
  return { ...pathDefaults, id: testShapeId('pen'), type: 'pen', points, ...overrides };
}

/** A fresh pointer input at a screen position (the real controller reuses one object). */
export function pointerAt(x: number, y: number, pointerId = 1) {
  return { pointerId, screen: { x, y } };
}
