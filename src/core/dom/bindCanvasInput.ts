import { createPoint } from '../geometry/point';
import type { InputController } from '../input/inputController';
import type { CanvasSurface } from './canvasSurface';

const PRIMARY_BUTTON = 0;

/**
 * Translates DOM events into controller calls. Returns a function that removes
 * every listener. Input objects are reused so pointermove allocates nothing.
 */
export function bindCanvasInput(
  canvas: HTMLCanvasElement,
  controller: InputController,
  surface: CanvasSurface,
): () => void {
  const abort = new AbortController();
  const { signal } = abort;
  const pointer = {
    pointerId: 0,
    screen: createPoint(),
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  };
  const wheelAnchor = createPoint();

  const readPointer = (event: PointerEvent) => {
    pointer.pointerId = event.pointerId;
    pointer.shiftKey = event.shiftKey;
    pointer.altKey = event.altKey;
    pointer.ctrlKey = event.ctrlKey;
    pointer.metaKey = event.metaKey;
    surface.toScreen(event.clientX, event.clientY, pointer.screen);
    return pointer;
  };
  const syncCursor = () => {
    const cursor = controller.cursor();
    if (canvas.style.cursor !== cursor) {
      canvas.style.cursor = cursor;
    }
  };
  const cancel = () => {
    controller.cancelGesture();
    syncCursor();
  };

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== PRIMARY_BUTTON) {
        return;
      }
      // Capture keeps the gesture alive when the pointer leaves the canvas or window.
      if (controller.pointerDown(readPointer(event))) {
        canvas.setPointerCapture(event.pointerId);
      }
      syncCursor();
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (event) => {
      controller.pointerMove(readPointer(event));
    },
    { signal },
  );
  canvas.addEventListener(
    'pointerup',
    (event) => {
      controller.pointerUp(readPointer(event));
      syncCursor();
    },
    { signal },
  );
  canvas.addEventListener('pointercancel', cancel, { signal });
  canvas.addEventListener('lostpointercapture', cancel, { signal });
  bindKeys(canvas, controller, syncCursor, signal);

  // Must be non-passive: preventDefault stops Ctrl + wheel from zooming the page.
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      surface.toScreen(event.clientX, event.clientY, wheelAnchor);
      const { deltaX, deltaY, deltaMode, ctrlKey } = event;
      controller.wheel(
        { deltaX, deltaY, deltaMode, ctrlKey, pageHeight: surface.cssHeight() },
        wheelAnchor,
      );
    },
    { signal, passive: false },
  );

  return () => {
    abort.abort();
  };
}

function bindKeys(
  canvas: HTMLCanvasElement,
  controller: InputController,
  syncCursor: () => void,
  signal: AbortSignal,
): void {
  // Keys go to the canvas only when it has focus, so typing elsewhere never triggers them.
  canvas.addEventListener(
    'keydown',
    (event) => {
      const { key, ctrlKey, metaKey, altKey } = event;
      if (controller.keyDown({ key, ctrlKey, metaKey, altKey })) {
        event.preventDefault();
      }
      syncCursor();
    },
    { signal },
  );
  canvas.addEventListener(
    'keyup',
    (event) => {
      controller.keyUp(event.key);
      syncCursor();
    },
    { signal },
  );
  window.addEventListener(
    'blur',
    () => {
      controller.releaseAll();
      syncCursor();
    },
    { signal },
  );
}
