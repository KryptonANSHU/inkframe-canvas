import { describe, expect, it, vi } from 'vitest';
import { EMPTY_DOCUMENT, insertShape } from '../document';
import { createEditorStore } from '../store';
import { fakeMeasurer, makeText, testShapeId } from '../testing/factories';
import { commitTextEdit } from './commitTextEdit';
import { editExisting } from './textShape';

// fakeMeasurer: 10 units per character, 20-unit lines. makeText is 240 wide.
const text = makeText({ x: 30, y: 40 });

function setup() {
  const store = createEditorStore({ document: insertShape(EMPTY_DOCUMENT, text) });
  const reportError = vi.fn();
  const commit = (typed: string) => {
    commitTextEdit(store, editExisting(text), typed, fakeMeasurer, reportError);
  };
  const stored = () => store.getState().document.shapes.get(text.id);
  return { store, commit, stored, reportError };
}

describe('commitTextEdit', () => {
  it('creates new text and selects it', () => {
    const store = createEditorStore({ activeTool: 'text' });
    const edit = { id: testShapeId('new'), x: 5, y: 6, original: null };
    commitTextEdit(store, edit, 'hi', fakeMeasurer, vi.fn());
    expect(store.getState().document.shapes.get(edit.id)).toMatchObject({ text: 'hi', x: 5 });
    expect([...store.getState().selectedIds]).toEqual([edit.id]);
    expect(store.getState().activeTool).toBe('select');
  });

  it('updates edited text in place, re-measuring its height, and selects it', () => {
    const { store, commit, stored } = setup();
    // 30 characters wrap onto two lines in 240 units.
    commit('one two three four five six se');
    expect(stored()).toMatchObject({ text: 'one two three four five six se', height: 40, x: 30 });
    expect([...store.getState().selectedIds]).toEqual([text.id]);
  });

  it('deletes text whose content was cleared, and leaves it unselected', () => {
    const { store, commit, stored } = setup();
    commit('  \n');
    expect(stored()).toBeUndefined();
    expect(store.getState().selectedIds.size).toBe(0);
  });

  it('changes nothing when the text is the same, apart from trailing whitespace', () => {
    const { store, commit } = setup();
    const before = store.getState().document;
    commit('Hello \n');
    expect(store.getState().document).toBe(before);
    expect([...store.getState().selectedIds]).toEqual([text.id]);
  });
});
