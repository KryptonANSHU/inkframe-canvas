import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMERA } from '../camera';
import { EMPTY_DOCUMENT } from '../document';
import { createEditorStore } from '../store';
import { pointerAt } from '../testing/factories';
import { createPanTool } from '../tools/panTool';
import { createRectangleTool } from '../tools/rectangleTool';
import { createInputController } from './inputController';

// Integration through the real tools: pointer input → tool → command → store.
function setup() {
  const store = createEditorStore();
  const errors: Error[] = [];
  const controller = createInputController(store, {
    draw: createRectangleTool(store, (error) => errors.push(error)),
    pan: createPanTool(store),
  });
  return { store, controller, errors };
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
    expect(controller.keyDown(' ')).toBe(true);
    expect(controller.cursor()).toBe('grab');
    drag(controller);
    expect(store.getState().document).toBe(EMPTY_DOCUMENT);
    expect(store.getState().camera).toEqual({ x: -100, y: -80, zoom: 1 });
  });

  it('keeps panning until pointerup when space is released mid-gesture', () => {
    const { store, controller } = setup();
    controller.keyDown(' ');
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
        c.keyDown('Escape');
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
    expect(controller.keyDown('Escape')).toBe(false);
    expect(controller.keyDown('a')).toBe(false);
  });

  it('forgets a held space on window blur', () => {
    const { controller } = setup();
    controller.keyDown(' ');
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
});
