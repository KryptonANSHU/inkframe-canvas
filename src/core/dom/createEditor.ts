import { createInputController } from '../input/inputController';
import { createRenderLoop, type FrameScheduler } from '../renderLoop';
import { createRenderer } from '../renderer';
import { createEditorStore, type EditorStore } from '../store';
import { createPanTool } from '../tools/panTool';
import { createRectangleTool } from '../tools/rectangleTool';
import { bindCanvasInput } from './bindCanvasInput';
import { observeCanvasSurface } from './canvasSurface';

export type EditorOptions = {
  /** Called for errors the user should hear about (failed commands, for now). */
  readonly reportError: (error: Error) => void;
};

export type Editor = {
  readonly store: EditorStore;
  /** Removes every listener and observer and stops drawing. */
  readonly dispose: () => void;
};

const animationFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => {
    cancelAnimationFrame(handle);
  },
};

/** Wires a canvas to a new editor: store → render loop → renderer, and DOM input → tools. */
export function createEditor(canvas: HTMLCanvasElement, options: EditorOptions): Editor {
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error("This browser can't draw on a canvas. Open Inkframe in a recent browser.");
  }
  const store = createEditorStore();
  const renderer = createRenderer(context);
  // `surface` is assigned below; draw only ever runs in a later animation frame.
  const loop = createRenderLoop(() => {
    renderer.draw(store.getState(), surface.viewport());
  }, animationFrames);
  const surface = observeCanvasSurface(canvas, loop.invalidate);
  const unsubscribe = store.subscribe(loop.invalidate);

  const controller = createInputController(store, {
    draw: createRectangleTool(store, options.reportError),
    pan: createPanTool(store),
  });
  const unbindInput = bindCanvasInput(canvas, controller, surface);
  canvas.style.cursor = controller.cursor();

  return {
    store,
    dispose: () => {
      unbindInput();
      unsubscribe();
      surface.dispose();
      loop.dispose();
    },
  };
}
