import { describe, expect, it } from 'vitest';
import { createEditorStore } from '../store';
import { pointerAt, testShapeId } from '../testing/factories';
import { createTextTool } from './textTool';

function setup(overrides = {}) {
  const store = createEditorStore({
    fontsReady: true,
    camera: { x: 100, y: 0, zoom: 2 },
    ...overrides,
  });
  return { store, tool: createTextTool(store) };
}

function click(tool: ReturnType<typeof setup>['tool'], x: number, y: number) {
  tool.pointerDown(pointerAt(x, y));
  tool.pointerMove(pointerAt(x, y));
  tool.pointerUp(pointerAt(x, y));
}

describe('text tool', () => {
  it('asks to edit text at the clicked world point', () => {
    const { store, tool } = setup();
    click(tool, 20, 40);
    expect(store.getState().textEdit).toMatchObject({ x: 110, y: 20 });
    expect(tool.getCursor()).toBe('text');
  });

  it('only ends the current edit when clicked while editing', () => {
    const editing = { id: testShapeId('open'), x: 0, y: 0 };
    const { store, tool } = setup({ textEdit: editing });
    tool.pointerDown(pointerAt(20, 40));
    // The textarea commits on blur and clears textEdit before the pointer comes up.
    store.setState({ textEdit: null });
    tool.pointerUp(pointerAt(20, 40));
    expect(store.getState().textEdit).toBeNull();
  });

  it('does nothing until fonts are ready', () => {
    const { store, tool } = setup({ fontsReady: false });
    click(tool, 20, 40);
    expect(store.getState().textEdit).toBeNull();
  });

  it('places nothing after cancel', () => {
    const { store, tool } = setup();
    tool.pointerDown(pointerAt(20, 40));
    tool.cancel();
    tool.pointerUp(pointerAt(20, 40));
    expect(store.getState().textEdit).toBeNull();
  });
});
