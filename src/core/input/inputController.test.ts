import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMERA } from '../camera';
import { EMPTY_DOCUMENT } from '../document';
import { createEditorStore } from '../store';
import { pointerAt } from '../testing/factories';
import { createDragShapeTool } from '../tools/dragShapeTool';
import { createPanTool } from '../tools/panTool';
import { createPenTool } from '../tools/penTool';
import { createSelectTool } from '../tools/selectTool';
import { createSpatialIndex } from '../spatial/spatialIndex';
import { bindSpatialIndex } from '../spatial/syncIndex';
import { createTextTool } from '../tools/textTool';
import {
  arrowBetween,
  ellipseBetween,
  lineBetween,
  rectangleBetween,
} from '../tools/shapeBuilders';
import { createInputController, type KeyInput } from './inputController';

// Integration through the real tools: pointer input → tool → command → store.
// Most cases start with the rectangle tool; select-tool cases switch with V.
function setup() {
  const store = createEditorStore({ activeTool: 'rectangle' });
  const index = createSpatialIndex();
  bindSpatialIndex(store, index);
  const errors: Error[] = [];
  const reportError = (error: Error) => errors.push(error);
  const controller = createInputController(
    store,
    {
      byId: {
        select: createSelectTool(store, index, reportError),
        rectangle: createDragShapeTool(store, reportError, rectangleBetween),
        ellipse: createDragShapeTool(store, reportError, ellipseBetween),
        line: createDragShapeTool(store, reportError, lineBetween),
        arrow: createDragShapeTool(store, reportError, arrowBetween),
        pen: createPenTool(store, reportError),
        text: createTextTool(store),
      },
      pan: createPanTool(store),
    },
    reportError,
  );
  return { store, controller, errors };
}

function key(name: string, modifiers: Partial<Omit<KeyInput, 'key'>> = {}): KeyInput {
  return {
    key: name,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
  };
}

function drag(controller: ReturnType<typeof setup>['controller'], pointerId = 1) {
  const started = controller.pointerDown(pointerAt(0, 0, pointerId));
  controller.pointerMove(pointerAt(50, 40, pointerId));
  controller.pointerUp(pointerAt(100, 80, pointerId));
  return started;
}

describe('input controller', () => {
  it('draws a rectangle with the default tool and asks for pointer capture', () => {
    const { store, controller, errors } = setup();
    expect(drag(controller)).toBe(true);
    expect(store.getState().document.order).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it('pans instead of drawing while space is held', () => {
    const { store, controller } = setup();
    expect(controller.keyDown(key(' '))).toBe(true);
    expect(controller.cursor()).toBe('grab');
    drag(controller);
    expect(store.getState().document).toBe(EMPTY_DOCUMENT);
    expect(store.getState().camera).toEqual({ x: -100, y: -80, zoom: 1 });
  });

  it('keeps panning until pointerup when space is released mid-gesture', () => {
    const { store, controller } = setup();
    controller.keyDown(key(' '));
    controller.pointerDown(pointerAt(0, 0));
    controller.keyUp(' ');
    expect(controller.cursor()).toBe('grabbing');
    controller.pointerMove(pointerAt(10, 0));
    controller.pointerUp(pointerAt(10, 0));
    expect(store.getState().camera.x).toBe(-10);
    expect(controller.cursor()).toBe('crosshair');
  });

  it('ignores a second pointer while a gesture is active', () => {
    const { store, controller } = setup();
    controller.pointerDown(pointerAt(0, 0, 1));
    expect(controller.pointerDown(pointerAt(5, 5, 2))).toBe(false);
    controller.pointerMove(pointerAt(500, 500, 2));
    controller.pointerUp(pointerAt(500, 500, 2));
    expect(store.getState().draft).toBeNull();
    controller.pointerMove(pointerAt(20, 20, 1));
    controller.pointerUp(pointerAt(20, 20, 1));
    expect(store.getState().document.order).toHaveLength(1);
  });

  type Controller = ReturnType<typeof setup>['controller'];
  it.each([
    [
      'cancelGesture (pointercancel / lost capture)',
      (c: Controller) => {
        c.cancelGesture();
      },
    ],
    [
      'Escape',
      (c: Controller) => {
        c.keyDown(key('Escape'));
      },
    ],
    [
      'window blur',
      (c: Controller) => {
        c.releaseAll();
      },
    ],
  ])('%s cancels a drag and leaves the document unchanged', (_name, cancel) => {
    const { store, controller } = setup();
    controller.pointerDown(pointerAt(0, 0));
    controller.pointerMove(pointerAt(60, 60));
    cancel(controller);
    controller.pointerMove(pointerAt(90, 90));
    controller.pointerUp(pointerAt(90, 90));
    expect(store.getState().draft).toBeNull();
    expect(store.getState().document).toBe(EMPTY_DOCUMENT);
  });

  it('does not claim Escape or other keys when there is nothing to cancel', () => {
    const { controller } = setup();
    expect(controller.keyDown(key('Escape'))).toBe(false);
    expect(controller.keyDown(key('x'))).toBe(false);
  });

  it('forgets a held space on window blur', () => {
    const { controller } = setup();
    controller.keyDown(key(' '));
    controller.releaseAll();
    expect(controller.cursor()).toBe('crosshair');
  });

  it('applies wheel input to the camera', () => {
    const { store, controller } = setup();
    controller.wheel(
      { deltaX: 0, deltaY: 40, deltaMode: 0, ctrlKey: false, pageHeight: 800 },
      { x: 0, y: 0 },
    );
    expect(store.getState().camera).toEqual({ ...DEFAULT_CAMERA, y: 40 });
  });

  it.each([
    ['r', 'rectangle'],
    ['o', 'ellipse'],
    ['L', 'line'],
    ['a', 'arrow'],
    ['p', 'pen'],
    ['T', 'text'],
  ] as const)('switches tools with the %s shortcut', (shortcut, tool) => {
    const { store, controller } = setup();
    store.setState({ activeTool: tool === 'rectangle' ? 'pen' : 'rectangle' });
    expect(controller.keyDown(key(shortcut))).toBe(true);
    expect(store.getState().activeTool).toBe(tool);
  });

  it('draws with the active tool', () => {
    const { store, controller } = setup();
    controller.keyDown(key('o'));
    drag(controller);
    const [id] = store.getState().document.order;
    expect(store.getState().document.shapes.get(id ?? ('' as never))?.type).toBe('ellipse');
  });

  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'leaves shortcuts with modifiers (%o) to the browser',
    (modifiers) => {
      const { store, controller } = setup();
      expect(controller.keyDown(key('p', modifiers))).toBe(false);
      expect(store.getState().activeTool).toBe('rectangle');
    },
  );

  it('does not switch tools in the middle of a gesture', () => {
    const { store, controller } = setup();
    controller.pointerDown(pointerAt(0, 0));
    expect(controller.keyDown(key('o'))).toBe(false);
    controller.pointerMove(pointerAt(50, 50));
    // Still the rectangle (not an ellipse), after which the select tool returns.
    controller.pointerUp(pointerAt(50, 50));
    const [id] = store.getState().document.order;
    expect(store.getState().document.shapes.get(id ?? ('' as never))?.type).toBe('rectangle');
  });

  it('selects a new shape and returns to the select tool after drawing it', () => {
    const { store, controller } = setup();
    drag(controller);
    const [id] = store.getState().document.order;
    expect([...store.getState().selectedIds]).toEqual([id]);
    expect(store.getState().activeTool).toBe('select');
  });

  it('Escape cancels a gesture first, then clears the selection, then does nothing', () => {
    const { store, controller } = setup();
    drag(controller);
    controller.pointerDown(pointerAt(200, 200));
    controller.pointerMove(pointerAt(260, 260));
    expect(controller.keyDown(key('Escape'))).toBe(true);
    expect(store.getState().selectedIds.size).toBe(1);
    expect(controller.keyDown(key('Escape'))).toBe(true);
    expect(store.getState().selectedIds.size).toBe(0);
    expect(controller.keyDown(key('Escape'))).toBe(false);
  });

  it('nudges the selection by 1, or 10 with Shift, as document changes', () => {
    const { store, controller } = setup();
    drag(controller);
    const [id] = store.getState().document.order;
    const x = () => store.getState().document.shapes.get(id ?? ('' as never))?.x;
    expect(controller.keyDown(key('ArrowRight'))).toBe(true);
    expect(x()).toBe(1);
    controller.keyDown(key('ArrowLeft', { shiftKey: true }));
    expect(x()).toBe(-9);
    controller.keyDown(key('ArrowDown'));
    expect(store.getState().document.shapes.get(id ?? ('' as never))?.y).toBe(1);
  });

  it('claims arrow keys without a selection, but leaves Ctrl / ⌘ / Alt + arrow alone', () => {
    const { controller } = setup();
    expect(controller.keyDown(key('ArrowUp'))).toBe(true);
    expect(controller.keyDown(key('ArrowUp', { metaKey: true }))).toBe(false);
  });

  it('sends hover to the idle tool so the select tool can show a move cursor', () => {
    const { controller } = setup();
    drag(controller);
    controller.pointerMove(pointerAt(50, 0));
    expect(controller.cursor()).toBe('move');
    controller.pointerMove(pointerAt(500, 500));
    expect(controller.cursor()).toBe('default');
  });
});
