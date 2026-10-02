import { describe, expect, it, vi } from 'vitest';
import {
  anchorPoint,
  attachmentViolations,
  deleteCommand,
  reshapeCommand,
  settleAttachments,
} from './attachments';
import { executeCommand, redo, undo } from './commands';
import { performEditAction } from './editActions';
import { invariantViolations } from './invariants';
import { documentFromShapes, toFile } from './persistence/fileFormat';
import { readFile } from './persistence/readFile';
import { pathWorldPoints } from './shapeGeometry';
import type { ArrowShape, Shape } from './shapes';
import { createEditorStore } from './store';
import { makeArrow, makeRect, testShapeId } from './testing/factories';

// Two boxes side by side, and an arrow from a's right edge to b's left edge.
const a = makeRect({ id: testShapeId('a'), x: 0, y: 0, width: 100, height: 50 });
const b = makeRect({ id: testShapeId('b'), x: 300, y: 0, width: 100, height: 50 });
const arrow: ArrowShape = makeArrow({
  x: 100,
  y: 25,
  points: [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ],
  start: { shapeId: a.id, anchor: 'right' },
  end: { shapeId: b.id, anchor: 'left' },
});

function setup(...selected: string[]) {
  return createEditorStore({
    document: documentFromShapes([a, b, arrow]),
    selectedIds: new Set(selected.map(testShapeId)),
  });
}
const get = (store: ReturnType<typeof setup>, name: string) =>
  store.getState().document.shapes.get(testShapeId(name));
const ends = (shape: Shape | undefined) => (shape?.type === 'arrow' ? pathWorldPoints(shape) : []);

/** Moves the named shapes (their document versions) as one reshape command. */
function move(store: ReturnType<typeof setup>, names: string[], dx: number, dy: number) {
  const { document } = store.getState();
  const shapes = names.flatMap((name) => document.shapes.get(testShapeId(name)) ?? []);
  const after = shapes.map((shape) => ({ ...shape, x: shape.x + dx, y: shape.y + dy }));
  executeCommand(store, reshapeCommand(document, 'Move', shapes, after));
}

describe('anchors', () => {
  it('sit at the center and edge midpoints, turning with the shape', () => {
    expect(anchorPoint(a, 'right')).toEqual({ x: 100, y: 25 });
    expect(anchorPoint(a, 'center')).toEqual({ x: 50, y: 25 });
    const turned = anchorPoint({ ...a, rotation: Math.PI / 2 }, 'right');
    expect(turned.x).toBeCloseTo(50);
    expect(turned.y).toBeCloseTo(75);
  });
});

describe('attached arrows', () => {
  it('follow a moved shape in the same undo step; undo and redo are exact', () => {
    const store = setup();
    const start = store.getState().document;
    move(store, ['b'], 40, 100);
    expect(ends(get(store, 'arrow'))).toEqual([
      { x: 100, y: 25 },
      { x: 340, y: 125 },
    ]);
    expect(store.getState().history.past).toHaveLength(1);
    expect(invariantViolations(store.getState())).toEqual([]);
    const moved = store.getState().document;
    undo(store);
    expect(store.getState().document).toEqual(start);
    redo(store);
    expect(store.getState().document).toEqual(moved);
  });

  it('stay attached when moved together with both shapes', () => {
    const store = setup();
    move(store, ['a', 'b', 'arrow'], 10, 10);
    expect(get(store, 'arrow')).toMatchObject({ start: arrow.start, end: arrow.end });
    expect(invariantViolations(store.getState())).toEqual([]);
  });

  it('let go of the ends whose shapes stay put when dragged on their own', () => {
    const store = setup();
    move(store, ['a', 'arrow'], 10, 10);
    const moved = get(store, 'arrow');
    expect(moved).toMatchObject({ start: arrow.start });
    expect(moved && 'end' in moved).toBe(false);
    expect(invariantViolations(store.getState())).toEqual([]);
  });

  it('let go when their shape is deleted, and get it back on undo', () => {
    const store = setup();
    const start = store.getState().document;
    executeCommand(store, deleteCommand(start, 'Delete', [get(store, 'b') ?? b]));
    const left = get(store, 'arrow');
    expect(left && 'end' in left).toBe(false);
    expect(invariantViolations(store.getState())).toEqual([]);
    undo(store);
    expect(store.getState().document).toEqual(start);
  });

  it('keep attachments within copies, pointing at the copied shapes', () => {
    const store = setup('a', 'b', 'arrow');
    performEditAction('duplicate', store, vi.fn());
    const copies = [...store.getState().selectedIds].map((id) =>
      store.getState().document.shapes.get(id),
    );
    const copiedArrow = copies.find((shape) => shape?.type === 'arrow');
    const copiedIds = new Set(copies.map((shape) => shape?.id));
    expect(copiedArrow?.type === 'arrow' && copiedIds.has(copiedArrow.start?.shapeId)).toBe(true);
    expect(invariantViolations(store.getState())).toEqual([]);

    store.setState({ selectedIds: new Set([arrow.id]) });
    performEditAction('duplicate', store, vi.fn());
    const [lone] = [...store.getState().selectedIds].map((id) =>
      store.getState().document.shapes.get(id),
    );
    expect(lone && ('start' in lone || 'end' in lone)).toBe(false);
  });

  it('survive a save and reload', () => {
    const document = documentFromShapes([a, b, arrow]);
    const read = readFile(toFile(document));
    expect(read.ok && read.value.at(-1)).toEqual(document.shapes.get(arrow.id));
    expect(read.ok && read.value.at(-1)).toMatchObject({ start: arrow.start, end: arrow.end });
  });

  it('are settled when loaded: dangling attachments dropped, ends put on anchors', () => {
    const stale = { ...arrow, x: arrow.x + 5 };
    const [, settled] = settleAttachments([b, stale]);
    expect(settled).toMatchObject({ end: arrow.end });
    expect(settled && 'start' in settled).toBe(false);
    expect(ends(settled)[1]).toEqual({ x: 300, y: 25 });
  });

  it('are checked by the invariants: shape exists, takes arrows, end on anchor', () => {
    const shapes = new Map<string, Shape>([[a.id, a]]);
    expect(attachmentViolations(arrow, (id) => shapes.get(id))).toEqual([
      'arrow: end is attached to b, which does not exist.',
    ]);
    shapes.set(b.id, { ...b, x: 310 });
    expect(attachmentViolations(arrow, (id) => shapes.get(id))).toEqual([
      'arrow: end is not on the left of b.',
    ]);
  });
});
