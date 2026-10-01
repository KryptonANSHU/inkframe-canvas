import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createShapeCommand,
  executeCommand,
  redo,
  undo,
  updateShapesCommand,
  type Command,
} from './commands';
import { EMPTY_DOCUMENT } from './document';
import { createShapeClipboard, performEditAction, type ShapeClipboard } from './editActions';
import { invariantViolations } from './invariants';
import { selectedShapes, nudgeSelection } from './selection/selectedShapes';
import { selectionFrame } from './selection/selectionFrame';
import type { Shape } from './shapes';
import { createSpatialIndex } from './spatial/spatialIndex';
import { bindSpatialIndex } from './spatial/syncIndex';
import { createEditorStore, type EditorStore } from './store';
import { shapeArbitrary } from './testing/arbitraries';
import { fakeMeasurer, testShapeId } from './testing/factories';
import { resizeFromHandle, resizeShapes } from './transform/resize';
import { rotateShapes } from './transform/rotate';

// One user action each, run through the same functions the editor uses.
type Step =
  | { readonly kind: 'create'; readonly shape: Shape }
  | { readonly kind: 'select'; readonly picks: readonly number[] }
  | { readonly kind: 'move'; readonly dx: number; readonly dy: number }
  | {
      readonly kind: 'resize';
      readonly x: -1 | 1;
      readonly y: -1 | 0 | 1;
      readonly tx: number;
      readonly ty: number;
    }
  | { readonly kind: 'rotate'; readonly angle: number }
  | { readonly kind: 'nudge'; readonly repeat: boolean }
  | { readonly kind: 'delete' | 'duplicate' | 'copy' | 'paste' | 'undo' | 'redo' };

let nextId = 0;
const freshShape = fc
  .constant(null)
  .chain(() => shapeArbitrary(testShapeId(`s${String(nextId++)}`)));
const distance = fc.double({ min: -500, max: 500, noNaN: true });

const step: fc.Arbitrary<Step> = fc.oneof(
  { weight: 4, arbitrary: freshShape.map((shape) => ({ kind: 'create' as const, shape })) },
  {
    weight: 2,
    arbitrary: fc
      .array(fc.nat(50), { maxLength: 4 })
      .map((picks) => ({ kind: 'select' as const, picks })),
  },
  {
    weight: 2,
    arbitrary: fc.record({ kind: fc.constant('move' as const), dx: distance, dy: distance }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('resize' as const),
      x: fc.constantFrom(-1 as const, 1 as const),
      y: fc.constantFrom(-1 as const, 0 as const, 1 as const),
      tx: distance,
      ty: distance,
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('rotate' as const),
      angle: fc.double({ min: -7, max: 7, noNaN: true }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('nudge' as const), repeat: fc.boolean() }),
  },
  {
    weight: 4,
    arbitrary: fc
      .constantFrom(...(['delete', 'duplicate', 'copy', 'paste', 'undo', 'undo', 'redo'] as const))
      .map((kind) => ({ kind })),
  },
);

const fail = (error: Error) => {
  throw error;
};

/** Runs a transform of the selection as one command, as the select tool does on release. */
function transformSelection(
  store: EditorStore,
  label: string,
  change: (shapes: readonly Shape[]) => Shape[],
): void {
  const before = selectedShapes(store.getState());
  if (before.length > 0) {
    const command: Command = updateShapesCommand(label, before, change(before));
    const result = executeCommand(store, command);
    if (!result.ok) fail(result.error);
  }
}

type Clipboard = { readonly clipboard: ShapeClipboard; copied: readonly Shape[] };

function run(store: EditorStore, s: Step, clip: Clipboard) {
  switch (s.kind) {
    case 'create':
      executeCommand(store, createShapeCommand(s.shape), { select: new Set([s.shape.id]) });
      return;
    case 'select': {
      const { order } = store.getState().document;
      const ids = s.picks.flatMap((p) => (order.length === 0 ? [] : [order[p % order.length]]));
      store.setState({ selectedIds: new Set(ids.filter((id) => id !== undefined)) });
      return;
    }
    case 'move':
      transformSelection(store, 'Move', (shapes) =>
        shapes.map((shape) => ({ ...shape, x: shape.x + s.dx, y: shape.y + s.dy })),
      );
      return;
    case 'resize':
      transformSelection(store, 'Resize', (shapes) => {
        const frame = selectionFrame(shapes);
        if (frame === null) return [...shapes];
        const options = { fromCenter: false, keepAspect: false };
        const result = resizeFromHandle(frame, { x: s.x, y: s.y }, { x: s.tx, y: s.ty }, options);
        return resizeShapes(shapes, frame, result, fakeMeasurer);
      });
      return;
    case 'rotate':
      transformSelection(store, 'Rotate', (shapes) => {
        const frame = selectionFrame(shapes);
        return frame === null
          ? [...shapes]
          : rotateShapes(shapes, frame.centerX, frame.centerY, s.angle);
      });
      return;
    case 'nudge':
      nudgeSelection(store, 1, 0, fail, s.repeat);
      return;
    case 'copy':
      clip.copied = clip.clipboard.copy(store);
      return;
    case 'paste':
      clip.clipboard.paste(store, clip.copied, fail);
      return;
    default:
      performEditAction(s.kind, store, fail);
  }
}

describe('history properties', () => {
  it('keeps every invariant after every step; undo all empties, redo all restores', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 30 }), (steps) => {
        const store = createEditorStore();
        const index = createSpatialIndex();
        bindSpatialIndex(store, index);
        const clipboard: Clipboard = { clipboard: createShapeClipboard(), copied: [] };
        for (const s of steps) {
          run(store, s, clipboard);
          expect(invariantViolations(store.getState(), index)).toEqual([]);
        }

        // Selection changes made after the last command aren't undo steps; compare from there.
        const { document, history } = store.getState();
        const selection = history.past.at(-1)?.selectionAfter;
        const undoable = history.past.length;
        while (undo(store) !== null) {
          expect(invariantViolations(store.getState(), index)).toEqual([]);
        }
        expect(store.getState().document).toEqual(EMPTY_DOCUMENT);
        expect(store.getState().selectedIds.size).toBe(0);
        // Only as many as were undone: steps undone earlier in the run stay redoable.
        for (let i = 0; i < undoable; i++) {
          redo(store);
          expect(invariantViolations(store.getState(), index)).toEqual([]);
        }
        expect(store.getState().document).toEqual(document);
        if (selection !== undefined) {
          expect(store.getState().selectedIds).toEqual(selection);
        }
      }),
      { numRuns: 1000 },
    );
  });
});
