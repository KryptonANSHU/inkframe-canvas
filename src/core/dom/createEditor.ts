import { ANCHOR_REACH_PX, findAnchor, type AnchorFinder } from '../attachments';
import { createInputController } from '../input/inputController';
import { startPersistence } from '../persistence/autosave';
import { createRenderLoop, type FrameScheduler } from '../renderLoop';
import { createRenderer } from '../renderer';
import { createSpatialIndex, type SpatialIndex } from '../spatial/spatialIndex';
import { bindSpatialIndex } from '../spatial/syncIndex';
import { createEditorStore, type EditorStore } from '../store';
import { createDragShapeTool } from '../tools/dragShapeTool';
import { createPanTool } from '../tools/panTool';
import { createPenTool } from '../tools/penTool';
import { createSelectTool } from '../tools/selectTool';
import {
  arrowBetween,
  ellipseBetween,
  lineBetween,
  rectangleBetween,
} from '../tools/shapeBuilders';
import { createTextTool } from '../tools/textTool';
import { createTextLayoutCache } from '../text/layout';
import {
  createShapeClipboard,
  performEditAction,
  type EditAction,
  type EditorHooks,
} from '../editActions';
import type { HistoryGroup } from '../history';
import type { ShapeStyle } from '../shapes';
import { applyStyle } from '../style';
import type { TextMeasurer } from '../text/layout';
import type { ToolId } from '../tools/toolIds';
import { bindCanvasInput } from './bindCanvasInput';
import { bindClipboard } from './clipboard';
import { createFileActions, type FileActions } from './files';
import { createExportClient } from './exportClient';
import { createFileReaderClient } from './fileWorkerClient';
import { createIndexedDbStorage } from './indexedDbStorage';
import { bindGridPreference } from './gridPreference';
import { watchThemeMode } from './themeMode';
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

/** Milliseconds the renderer spent drawing one frame. */
export type FrameListener = (drawMs: number) => void;

export type Editor = {
  readonly store: EditorStore;
  /** Always in sync with the store's document; hit-testing reads it (M3b). */
  readonly index: SpatialIndex;
  /** Open, Save, and Export, for the main menu. */
  readonly files: FileActions;
  /** Text measurement with the editor's font, for anything that creates text (plugins). */
  readonly measurer: TextMeasurer;
  /** Runs what a shortcut would: undo, zoom, arrange, and so on (for buttons). */
  readonly perform: (action: EditAction) => void;
  readonly setTool: (tool: ToolId) => void;
  /** Restyles the selection as one undo step; `group` joins a slider drag into one. */
  readonly applyStyle: (patch: Partial<ShapeStyle>, group?: HistoryGroup) => void;
  /** Gives the canvas keyboard focus back after a pointer click on a control. */
  readonly focus: () => void;
  /** Removes every listener and observer and stops drawing. */
  readonly dispose: () => void;
  /** Called after every drawn frame with the draw time; returns an unsubscribe. */
  readonly onFrame: (listener: FrameListener) => () => void;
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
  const unwatchInvariants = watchInvariantsInDev(store, index, options.reportError);
  const unwatchTheme = watchThemeMode(store);
  const unbindGrid = bindGridPreference(store);
  const measurer = createCanvasTextMeasurer();
  const textLayouts = createTextLayoutCache(measurer);
  const renderer = createRenderer(
    context,
    (shape) => textLayouts.layout(shape),
    (area) => index.query(area),
  );
  // `surface` is assigned below; draw only ever runs in a later animation frame.
  // Timed only while someone listens (the ?debug=1 meter, the benchmark).
  const frameListeners = new Set<FrameListener>();
  const loop = createRenderLoop(
    () => {
      const started = frameListeners.size > 0 ? performance.now() : 0;
      renderer.draw(store.getState(), surface.viewport());
      if (frameListeners.size > 0) {
        const drawMs = performance.now() - started;
        for (const listener of frameListeners) listener(drawMs);
      }
    },
    animationFrames,
    options.reportError,
  );
  const surface = observeCanvasSurface(canvas, loop.invalidate);
  const unsubscribe = store.subscribe(loop.invalidate);

  const { reportError } = options;
  const reader = createFileReaderClient();
  const exporter = createExportClient();
  const files = createFileActions({ store, reader, exporter, measurer, reportError });
  const persistence = startPersistence({
    store,
    storage: createIndexedDbStorage(),
    readFileText: (text) => reader.read(text),
    reportError,
  });
  const unbindFlush = flushWhenHidden(() => void persistence.flush());
  const unbindClipboard = bindClipboard({
    canvas,
    store,
    clipboard: createShapeClipboard(),
    reader,
    reportError,
  });
  // Arrow ends attach to shapes found through the spatial index, near the pointer.
  const anchors: AnchorFinder = (point, avoid) => {
    const { document, camera } = store.getState();
    const reach = ANCHOR_REACH_PX / camera.zoom;
    const nearby = index.query({
      minX: point.x - reach,
      minY: point.y - reach,
      maxX: point.x + reach,
      maxY: point.y + reach,
    });
    return findAnchor(document, nearby, point, camera.zoom, avoid);
  };
  const hooks: EditorHooks = {
    open: () => {
      files.open();
    },
    save: () => {
      files.save();
    },
    viewSize: () => ({ width: surface.cssWidth(), height: surface.cssHeight() }),
  };
  const controller = createInputController(
    store,
    {
      byId: {
        select: createSelectTool({ store, index, measurer, reportError, anchors }),
        rectangle: createDragShapeTool(store, reportError, rectangleBetween),
        ellipse: createDragShapeTool(store, reportError, ellipseBetween),
        line: createDragShapeTool(store, reportError, lineBetween),
        arrow: createDragShapeTool(store, reportError, arrowBetween, anchors),
        pen: createPenTool(store, reportError),
        text: createTextTool(store),
      },
      pan: createPanTool(store),
    },
    reportError,
    hooks,
  );
  const unbindInput = bindCanvasInput(canvas, controller, surface);
  canvas.style.cursor = controller.cursor();
  // Shortcuts are heard only while the canvas has focus, and nothing has focus on load:
  // without this, the first tool key is ignored and the next drag is a marquee. No ring
  // for a focus the user didn't move; browsers without `focusVisible` just show it.
  canvas.focus({ preventScroll: true, focusVisible: false });
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
    files,
    measurer,
    onFrame: (listener) => {
      frameListeners.add(listener);
      return () => {
        frameListeners.delete(listener);
      };
    },
    perform: (action) => {
      performEditAction(action, store, reportError, hooks);
    },
    setTool: (tool) => {
      store.setState({ activeTool: tool });
    },
    applyStyle: (patch, group) => {
      applyStyle(store, patch, reportError, group);
    },
    focus: () => {
      canvas.focus({ preventScroll: true, focusVisible: false });
    },
    dispose: () => {
      unwatchTheme();
      unbindGrid();
      unbindClipboard();
      unbindFlush();
      void persistence.flush();
      persistence.dispose();
      reader.dispose();
      exporter.dispose();
      unbindTextEditor();
      unbindInput();
      unsubscribe();
      unwatchInvariants();
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

/**
 * Checks document invariants after every change, in dev builds only. Loaded on demand
 * so production never bundles the checker or the zod schema it uses. Subscribes after
 * the spatial index, so it sees the index already synced to each change.
 */
function watchInvariantsInDev(
  store: EditorStore,
  index: SpatialIndex,
  reportError: (error: Error) => void,
): () => void {
  if (!import.meta.env.DEV) {
    return () => undefined;
  }
  let unwatch: (() => void) | null = null;
  let disposed = false;
  import('../invariants').then(
    ({ watchInvariants }) => {
      if (!disposed) {
        unwatch = watchInvariants(store, index, reportError);
      }
    },
    (cause: unknown) => {
      reportError(new Error('The dev invariants checker failed to load.', { cause }));
    },
  );
  return () => {
    disposed = true;
    unwatch?.();
  };
}

/**
 * Saves a pending change as soon as the tab is hidden: the last chance before it may be
 * closed or discarded, rather than waiting out the autosave delay.
 */
function flushWhenHidden(flush: () => void): () => void {
  const onChange = () => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  };
  document.addEventListener('visibilitychange', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
  };
}
