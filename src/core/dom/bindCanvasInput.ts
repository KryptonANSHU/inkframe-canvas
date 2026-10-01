import { createPoint } from '../geometry/point';
import type { InputController } from '../input/inputController';
import type { CanvasSurface } from './canvasSurface';

const PRIMARY_BUTTON = 0;
/** What a pressed mouse reports; used for every pointer that can't sense pressure. */
const DEFAULT_PRESSURE = 0.5;

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
    pressure: 0,
    pointerType: '',
  };
  const wheelAnchor = createPoint();

  const readPointer = (event: PointerEvent) => {
    pointer.pointerId = event.pointerId;
    pointer.pointerType = event.pointerType;
    // Only a stylus measures pressure. Some trackpads report click force instead,
    // which would make mouse strokes randomly hairline-thin.
    pointer.pressure = event.pointerType === 'pen' ? event.pressure : DEFAULT_PRESSURE;
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
      // No text selection or native drag can start on the canvas and cancel the
      // gesture. That also skips the default focus change, so focus is moved here.
      event.preventDefault();
      canvas.focus({ preventScroll: true, focusVisible: false });
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
      // Browsers deliver one move per frame; the pen asks for the ones merged into it.
      const moves = controller.wantsEveryMove() ? coalescedMoves(event) : [event];
      for (const move of moves) {
        controller.pointerMove(readPointer(move));
      }
      syncCursor();
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
  canvas.addEventListener(
    'dblclick',
    (event) => {
      surface.toScreen(event.clientX, event.clientY, pointer.screen);
      const { shiftKey, altKey, ctrlKey, metaKey } = event;
      controller.doubleClick({ ...pointer, shiftKey, altKey, ctrlKey, metaKey });
      syncCursor();
    },
    { signal },
  );
  canvas.addEventListener('pointercancel', cancel, { signal });
  canvas.addEventListener('lostpointercapture', cancel, { signal });
  bindKeys(canvas, controller, syncCursor, signal);
  bindChromeKeys(canvas, controller, syncCursor, signal);

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
      const { key, ctrlKey, metaKey, altKey, shiftKey, repeat } = event;
      if (controller.keyDown({ key, ctrlKey, metaKey, altKey, shiftKey, repeat })) {
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

/** The moves merged into this event, oldest first; just the event where unsupported. */
function coalescedMoves(event: PointerEvent): readonly PointerEvent[] {
  // Older browsers lack it, though the DOM types always declare it.
  const merged = 'getCoalescedEvents' in event ? event.getCoalescedEvents() : [];
  return merged.length > 0 ? merged : [event];
}

/**
 * Tool and edit shortcuts also work while a toolbar or panel control has focus
 * (CLAUDE.md), but never while typing, and never for keys a control handled itself.
 */
function bindChromeKeys(
  canvas: HTMLCanvasElement,
  controller: InputController,
  syncCursor: () => void,
  signal: AbortSignal,
): void {
  canvas.parentElement?.addEventListener(
    'keydown',
    (event) => {
      if (event.target === canvas || event.defaultPrevented || isTextEntry(event.target)) {
        return;
      }
      const { key, ctrlKey, metaKey, altKey, shiftKey, repeat } = event;
      if (controller.chromeKeyDown({ key, ctrlKey, metaKey, altKey, shiftKey, repeat })) {
        event.preventDefault();
      }
      syncCursor();
    },
    { signal },
  );
}

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLInputElement)
  );
}
