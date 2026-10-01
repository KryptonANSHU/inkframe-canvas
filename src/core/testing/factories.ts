import {
  DEFAULT_SHAPE_STYLE,
  type ArrowShape,
  type EllipseShape,
  type LineShape,
  type PenShape,
  type RectShape,
  type ShapeId,
  type TextShape,
} from '../shapes';
import type { TextMeasurer } from '../text/layout';

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

export function makeText(overrides: Partial<Omit<TextShape, 'type'>> = {}): TextShape {
  return {
    ...makeRect({ width: 240, height: 20 }),
    id: testShapeId('text'),
    type: 'text',
    text: 'Hello',
    fontSize: 20,
    ...overrides,
  };
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Every grapheme is 10 units wide at any size; lines are 20 tall with a 16 ascent. */
export const fakeMeasurer: TextMeasurer = {
  width: (text) => Array.from(graphemes.segment(text)).length * 10,
  metrics: () => ({ ascent: 16, lineHeight: 20 }),
};

export type PointerOptions = {
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly pressure?: number;
  readonly pointerType?: string;
};

/** A fresh pointer input at a screen position (the real controller reuses one object). */
export function pointerAt(x: number, y: number, pointerId = 1, options: PointerOptions = {}) {
  return {
    pointerId,
    screen: { x, y },
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    pressure: 0.5,
    pointerType: 'mouse',
    ...options,
  };
}
