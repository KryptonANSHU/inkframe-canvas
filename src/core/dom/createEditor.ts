import { createInputController } from '../input/inputController';
import { createRenderLoop, type FrameScheduler } from '../renderLoop';
import { createRenderer } from '../renderer';
import { createSpatialIndex, type SpatialIndex } from '../spatial/spatialIndex';
import { bindSpatialIndex } from '../spatial/syncIndex';
import { createEditorStore, type EditorStore } from '../store';
import { createDragShapeTool } from '../tools/dragShapeTool';
import { createPanTool } from '../tools/panTool';
import { createPenTool } from '../tools/penTool';
import {
  arrowBetween,
  ellipseBetween,
  lineBetween,
  rectangleBetween,
} from '../tools/shapeBuilders';
import { bindCanvasInput } from './bindCanvasInput';
import { observeCanvasSurface } from './canvasSurface';

export type EditorOptions = {
  /** Called for errors the user should hear about (failed commands, for now). */
  readonly reportError: (error: Error) => void;
};

export type Editor = {
  readonly store: EditorStore;
  /** Always in sync with the store's document; hit-testing reads it (M3b). */
  readonly index: SpatialIndex;
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
  const index = createSpatialIndex();
  const unbindIndex = bindSpatialIndex(store, index);
  const renderer = createRenderer(context);
  // `surface` is assigned below; draw only ever runs in a later animation frame.
  const loop = createRenderLoop(() => {
    renderer.draw(store.getState(), surface.viewport());
  }, animationFrames);
  const surface = observeCanvasSurface(canvas, loop.invalidate);
  const unsubscribe = store.subscribe(loop.invalidate);

  const { reportError } = options;
  const controller = createInputController(store, {
    byId: {
      rectangle: createDragShapeTool(store, reportError, rectangleBetween),
      ellipse: createDragShapeTool(store, reportError, ellipseBetween),
      line: createDragShapeTool(store, reportError, lineBetween),
      arrow: createDragShapeTool(store, reportError, arrowBetween),
      pen: createPenTool(store, reportError),
    },
    pan: createPanTool(store),
  });
  const unbindInput = bindCanvasInput(canvas, controller, surface);
  canvas.style.cursor = controller.cursor();

  return {
    store,
    index,
    dispose: () => {
      unbindInput();
      unsubscribe();
      unbindIndex();
      surface.dispose();
      loop.dispose();
    },
  };
}
