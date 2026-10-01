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
import { createTextTool } from '../tools/textTool';
import { createTextLayoutCache } from '../text/layout';
import { bindCanvasInput } from './bindCanvasInput';
import { observeCanvasSurface } from './canvasSurface';
import { createCanvasTextMeasurer } from './canvasTextMeasurer';
import { loadTextFont } from './fonts';
import { bindTextEditor } from './textEditor';

export type EditorOptions = {
  /** Called for errors the user should hear about (failed commands, font loading). */
  readonly reportError: (error: Error) => void;
  /** CSS class for the text-editing textarea, so its static look stays in CSS. */
  readonly textEditorClassName: string;
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
  const measurer = createCanvasTextMeasurer();
  const textLayouts = createTextLayoutCache(measurer);
  const renderer = createRenderer(context, (shape) => textLayouts.layout(shape));
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
      text: createTextTool(store),
    },
    pan: createPanTool(store),
  });
  const unbindInput = bindCanvasInput(canvas, controller, surface);
  canvas.style.cursor = controller.cursor();
  const unbindTextEditor = bindTextEditor({
    store,
    canvas,
    className: options.textEditorClassName,
    measurer,
    reportError,
  });
  watchFontLoad(
    store,
    () => {
      measurer.reset();
      textLayouts.reset();
    },
    reportError,
  );

  return {
    store,
    index,
    dispose: () => {
      unbindTextEditor();
      unbindInput();
      unsubscribe();
      unbindIndex();
      surface.dispose();
      loop.dispose();
    },
  };
}

/**
 * Marks fonts ready once the text font loads; measurements taken before then used a
 * fallback font, so `resetMeasurements` drops them. If loading fails, text still
 * works in a system font and the user is told why it looks different.
 */
function watchFontLoad(
  store: EditorStore,
  resetMeasurements: () => void,
  reportError: (error: Error) => void,
): void {
  const ready = () => {
    resetMeasurements();
    store.setState({ fontsReady: true });
  };
  loadTextFont().then(ready, (cause: unknown) => {
    reportError(
      new Error("The text font didn't load, so text uses a system font. Reload to try again.", {
        cause,
      }),
    );
    ready();
  });
}
