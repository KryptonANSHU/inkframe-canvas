import { describe, expect, it } from 'vitest';
import { CommandError, createShapeCommand, executeCommand, type Command } from './commands';
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
