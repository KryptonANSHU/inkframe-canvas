import { describe, expect, it } from 'vitest';
import { makeLine, makeRect, makeText, testShapeId } from '../testing/factories';
import { availableHandles, handleAt, handleCursor, handlePosition, uniformOnly } from './handles';
import { selectionFrame, type SelectionFrame } from './selectionFrame';

const camera = { x: 0, y: 0, zoom: 1 };

function frameOf(shapes: Parameters<typeof selectionFrame>[0]): SelectionFrame {
  const frame = selectionFrame(shapes);
  if (frame === null) throw new Error('no frame');
  return frame;
}

describe('availableHandles', () => {
  it('offers 8 resize handles and rotation for a shape', () => {
    const shapes = [makeRect()];
    expect(availableHandles(shapes, frameOf(shapes), 1).sort()).toEqual(
      ['e', 'n', 'ne', 'nw', 'rotate', 's', 'se', 'sw', 'w'].sort(),
    );
  });

  it('offers only the two ends of a lone line', () => {
    const shapes = [makeLine()];
    expect(availableHandles(shapes, frameOf(shapes), 1)).toEqual(['start', 'end']);
  });

  it('gives lone text side handles but no top or bottom', () => {
    const shapes = [makeText({ height: 60 })];
    expect(availableHandles(shapes, frameOf(shapes), 1)).not.toContain('n');
    expect(availableHandles(shapes, frameOf(shapes), 1)).toContain('e');
  });

  it('drops side handles when the frame is too small on screen', () => {
    const shapes = [makeRect({ width: 100, height: 10 })];
    const handles = availableHandles(shapes, frameOf(shapes), 1);
    expect(handles).not.toContain('e');
    expect(handles).toContain('n');
  });

  it('keeps only corners for a group that can only scale uniformly', () => {
    const shapes = [
      makeRect({ id: testShapeId('a') }),
      makeRect({ id: testShapeId('b'), x: 300, rotation: 0.4 }),
    ];
    const frame = frameOf(shapes);
    expect(uniformOnly(shapes, frame)).toBe(true);
    expect(availableHandles(shapes, frame, 1).sort()).toEqual(['ne', 'nw', 'rotate', 'se', 'sw']);
  });

  it('lets a group of quarter-turned shapes stretch freely', () => {
    const shapes = [
      makeRect({ id: testShapeId('a') }),
      makeRect({ id: testShapeId('b'), x: 300, rotation: Math.PI / 2 }),
    ];
    expect(uniformOnly(shapes, frameOf(shapes))).toBe(false);
  });
});

describe('handlePosition and handleAt', () => {
  const shapes = [makeRect({ x: 0, y: 0, width: 100, height: 50 })];
  const frame = frameOf(shapes);

  it('puts resize handles on the frame and rotation above it, at a fixed screen distance', () => {
    expect(handlePosition('se', shapes, frame, 1)).toEqual({ x: 100, y: 50 });
    expect(handlePosition('rotate', shapes, frame, 1)).toEqual({ x: 50, y: -24 });
    expect(handlePosition('rotate', shapes, frame, 2)).toEqual({ x: 50, y: -12 });
  });

  it('finds the handle under the pointer within 8 screen pixels', () => {
    expect(handleAt(shapes, frame, camera, { x: 104, y: 54 })).toBe('se');
    expect(handleAt(shapes, frame, camera, { x: 50, y: -20 })).toBe('rotate');
    expect(handleAt(shapes, frame, camera, { x: 70, y: 25 })).toBeNull();
  });

  it('places line handles on its ends', () => {
    const line = [makeLine({ x: 10, y: 10 })];
    expect(handlePosition('end', line, frameOf(line), 1)).toEqual({ x: 110, y: 60 });
  });
});

describe('handleCursor', () => {
  const frame = { centerX: 0, centerY: 0, width: 10, height: 10, rotation: 0 };

  it('points along the drag, and turns with the frame', () => {
    expect(handleCursor('e', frame)).toBe('ew-resize');
    expect(handleCursor('se', frame)).toBe('nwse-resize');
    expect(handleCursor('ne', frame)).toBe('nesw-resize');
    expect(handleCursor('e', { ...frame, rotation: Math.PI / 2 })).toBe('ns-resize');
    expect(handleCursor('rotate', frame)).toBe('grab');
    expect(handleCursor('end', frame)).toBe('crosshair');
  });
});
