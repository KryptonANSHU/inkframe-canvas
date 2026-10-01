import { DEFAULT_SHAPE_STYLE, type RectShape, type ShapeId } from '../shapes';

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
