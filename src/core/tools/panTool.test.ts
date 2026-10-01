import { describe, expect, it } from 'vitest';
import { EMPTY_DOCUMENT } from '../document';
import { createEditorStore } from '../store';
import { pointerAt } from '../testing/factories';
import { createPanTool } from './panTool';

describe('pan tool', () => {
  it('moves the content with the pointer, at any zoom', () => {
    const store = createEditorStore({ camera: { x: 0, y: 0, zoom: 2 } });
    const tool = createPanTool(store);
    tool.pointerDown(pointerAt(100, 100));
    tool.pointerMove(pointerAt(120, 90));
    tool.pointerMove(pointerAt(140, 80));
    tool.pointerUp(pointerAt(140, 80));

    // 40 px right and 20 px up on screen = 20 and 10 world units at zoom 2.
    expect(store.getState().camera).toEqual({ x: -20, y: 10, zoom: 2 });
    expect(store.getState().document).toBe(EMPTY_DOCUMENT);
  });

  it('ignores moves when not dragging', () => {
    const store = createEditorStore();
    const tool = createPanTool(store);
    const before = store.getState().camera;
    tool.pointerMove(pointerAt(50, 50));
    tool.pointerDown(pointerAt(0, 0));
    tool.cancel();
    tool.pointerMove(pointerAt(50, 50));
    expect(store.getState().camera).toBe(before);
  });

  it('shows an open hand, and a closed hand while dragging', () => {
    const tool = createPanTool(createEditorStore());
    expect(tool.getCursor()).toBe('grab');
    tool.pointerDown(pointerAt(0, 0));
    expect(tool.getCursor()).toBe('grabbing');
    tool.pointerUp(pointerAt(0, 0));
    expect(tool.getCursor()).toBe('grab');
  });
});
