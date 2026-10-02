import { describe, expect, it } from 'vitest';
import type { GroupId } from '../shapes';
import { makeArrow, makePen, makeRect, makeText } from '../testing/factories';
import { describeShape } from './describeShape';

describe('describeShape', () => {
  it('names a box by kind, size, and top-left corner', () => {
    expect(describeShape(makeRect({ x: 200, y: 300, width: 120, height: 80 }))).toBe(
      'Rectangle, 120 × 80 at 200, 300',
    );
  });

  it('notes rotation and grouping', () => {
    const shape = makeRect({
      width: 100,
      height: 100,
      rotation: Math.PI / 4,
      groupId: 'g' as GroupId,
    });
    expect(describeShape(shape)).toMatch(
      /^Rectangle, 141 × 141 at -21, -21, rotated 45°, in a group$/,
    );
  });

  it('says where a line or arrow runs', () => {
    const arrow = makeArrow({
      x: 100,
      y: 25,
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
    });
    expect(describeShape(arrow)).toBe('Arrow from 100, 25 to 300, 25');
  });

  it('quotes text on one line, cut at 60 characters', () => {
    expect(describeShape(makeText({ text: 'Hello\n  world' }))).toBe('Text “Hello world”');
    expect(describeShape(makeText({ text: 'x'.repeat(80) }))).toBe(`Text “${'x'.repeat(59)}…”`);
  });

  it('names freehand strokes in plain words', () => {
    expect(describeShape(makePen())).toBe('Freehand stroke, 40 × 40 at 0, 0');
  });
});
