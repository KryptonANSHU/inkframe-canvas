import { describe, expect, it } from 'vitest';
import {
  CommandError,
  createShapeCommand,
  createShapesCommand,
  deleteShapesCommand,
  executeCommand,
  redo,
  undo,
  updateShapesCommand,
  type Command,
} from './commands';
import { MAX_HISTORY } from './history';
import { EMPTY_DOCUMENT, insertShape } from './document';
import { createEditorStore } from './store';
import { makeRect, testShapeId } from './testing/factories';

const existing = makeRect({ id: testShapeId('existing'), zIndex: 0 });
const start = insertShape(EMPTY_DOCUMENT, existing);

describe('createShapeCommand', () => {
  const command = createShapeCommand(makeRect({ id: testShapeId('new'), zIndex: 99 }));

  it('puts the new shape on top, whatever zIndex it came with', () => {
    const after = command.do(start);
    expect(after.order).toEqual(['existing', 'new']);
    expect(after.shapes.get(testShapeId('new'))?.zIndex).toBe(1);
  });

  it('do → undo → redo restores the exact same documents', () => {
    const afterDo = command.do(start);
    const afterUndo = command.undo(afterDo);
    const afterRedo = command.do(afterUndo);
    expect(afterUndo).toEqual(start);
    expect(afterRedo).toEqual(afterDo);
  });
});

describe('executeCommand', () => {
  it('stores the new document and returns it', () => {
    const store = createEditorStore({ document: start });
    const result = executeCommand(store, createShapeCommand(makeRect({ id: testShapeId('n') })));
    expect(result.ok).toBe(true);
    expect(store.getState().document.order).toEqual(['existing', 'n']);
  });

  it('applies nothing and returns the error when the command throws', () => {
    const store = createEditorStore({ document: start });
    const result = executeCommand(store, createShapeCommand(existing));
    expect(store.getState().document).toBe(start);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(CommandError);
      expect(result.error.message).toMatch(/^Create shape failed: .*already exists/);
    }
  });

  it('wraps non-Error throws', () => {
    const store = createEditorStore();
    const failing: Command = {
      label: 'Broken',
      do: () => {
        // Simulates a third-party bug that throws a non-Error value.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'boom';
      },
      undo: (document) => document,
    };
    const result = executeCommand(store, failing);
    expect(result.ok ? null : result.error.message).toBe('Broken failed: boom');
  });
});

describe('updateShapesCommand', () => {
  const moved = { ...existing, x: 300, y: 40 };
  const command = updateShapesCommand('Move', [existing], [moved]);

  it('do → undo → redo restores the exact same documents', () => {
    const afterDo = command.do(start);
    expect(afterDo.shapes.get(existing.id)).toEqual(moved);
    expect(command.undo(afterDo)).toEqual(start);
    expect(command.do(command.undo(afterDo))).toEqual(afterDo);
  });

  it('refuses mismatched before and after lists', () => {
    expect(() => updateShapesCommand('Move', [existing], [])).toThrow(/same shapes/);
  });
});

describe('deleteShapesCommand', () => {
  const top = makeRect({ id: testShapeId('top'), zIndex: 2 });
  const middle = makeRect({ id: testShapeId('middle'), zIndex: 1 });
  const three = insertShape(insertShape(start, middle), top);

  it('removes the shapes and renumbers the rest', () => {
    const after = deleteShapesCommand('Delete', [existing]).do(three);
    expect(after.order).toEqual(['middle', 'top']);
    expect(after.shapes.get(testShapeId('top'))?.zIndex).toBe(1);
  });

  it('do → undo → redo restores the exact same documents, in any listed order', () => {
    const command = deleteShapesCommand('Delete', [top, existing]);
    const afterDo = command.do(three);
    const afterUndo = command.undo(afterDo);
    expect(afterDo.order).toEqual(['middle']);
    expect(afterUndo).toEqual(three);
    expect(command.do(afterUndo)).toEqual(afterDo);
  });
});

describe('createShapesCommand', () => {
  it('stacks the shapes on top in the given order; do → undo → redo is exact', () => {
    const a = makeRect({ id: testShapeId('a') });
    const b = makeRect({ id: testShapeId('b') });
    const command = createShapesCommand('Paste', [a, b]);
    const afterDo = command.do(start);
    expect(afterDo.order).toEqual(['existing', 'a', 'b']);
    expect(command.undo(afterDo)).toEqual(start);
    expect(command.do(command.undo(afterDo))).toEqual(afterDo);
  });
});

describe('undo and redo', () => {
  const a = makeRect({ id: testShapeId('a') });
  const b = makeRect({ id: testShapeId('b') });

  function twoSteps() {
    const store = createEditorStore();
    executeCommand(store, createShapeCommand(a), { select: new Set([a.id]) });
    executeCommand(store, createShapeCommand(b), { select: new Set([b.id]) });
    return store;
  }

  it('step back and forth through documents and selections exactly', () => {
    const store = twoSteps();
    const end = store.getState();
    undo(store);
    expect(store.getState().document.order).toEqual(['a']);
    expect([...store.getState().selectedIds]).toEqual(['a']);
    undo(store);
    expect(store.getState().document).toEqual(EMPTY_DOCUMENT);
    expect(store.getState().selectedIds.size).toBe(0);
    expect(undo(store)).toBeNull();
    redo(store);
    redo(store);
    expect(store.getState().document).toEqual(end.document);
    expect(store.getState().selectedIds).toEqual(end.selectedIds);
    expect(redo(store)).toBeNull();
  });

  it('forgets undone steps once a new command runs', () => {
    const store = twoSteps();
    undo(store);
    executeCommand(store, createShapeCommand(makeRect({ id: testShapeId('c') })));
    expect(store.getState().history.future).toEqual([]);
    expect(redo(store)).toBeNull();
  });

  it('joins grouped commands into one step, and starts a new one when told to', () => {
    const store = createEditorStore({ document: start });
    const nudge = (x: number, continues: boolean) => {
      const before = store.getState().document.shapes.get(existing.id) ?? existing;
      executeCommand(store, updateShapesCommand('Nudge', [before], [{ ...before, x }]), {
        group: { key: 'nudge', continues },
      });
    };
    nudge(1, false);
    nudge(2, true);
    nudge(3, true);
    nudge(4, false);
    expect(store.getState().history.past).toHaveLength(2);
    undo(store);
    expect(store.getState().document.shapes.get(existing.id)?.x).toBe(3);
    undo(store);
    expect(store.getState().document).toEqual(start);
  });

  it(`keeps at most ${String(MAX_HISTORY)} steps`, () => {
    const store = createEditorStore();
    for (let i = 0; i <= MAX_HISTORY; i++) {
      executeCommand(store, createShapeCommand(makeRect({ id: testShapeId(`r${String(i)}`) })));
    }
    expect(store.getState().history.past).toHaveLength(MAX_HISTORY);
  });
});
