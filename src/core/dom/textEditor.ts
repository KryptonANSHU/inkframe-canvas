import { worldToScreen, type Camera } from '../camera';
import { createShapeCommand, executeCommand } from '../commands';
import { DEFAULT_SHAPE_STYLE } from '../shapes';
import type { EditorStore } from '../store';
import { DEFAULT_FONT_SIZE, DEFAULT_TEXT_WIDTH, fontString } from '../text/font';
import type { TextMeasurer } from '../text/layout';
import { createTextShape, type TextPlacement } from '../text/textShape';

export type TextEditorOptions = {
  readonly store: EditorStore;
  readonly canvas: HTMLCanvasElement;
  /** Static look of the textarea (no border, transparent, no resize), from the UI layer. */
  readonly className: string;
  readonly measurer: TextMeasurer;
  readonly reportError: (error: Error) => void;
};

/**
 * Opens a <textarea> over the canvas whenever the store gets a `textEdit`, keeps it
 * aligned with the camera, and commits the text as one shape on blur, Escape, or
 * Ctrl/Cmd + Enter. Returns a function that removes it without committing.
 */
export function bindTextEditor(options: TextEditorOptions): () => void {
  const { store, canvas } = options;
  let open: { textarea: HTMLTextAreaElement; abort: AbortController } | null = null;

  const close = () => {
    open?.abort.abort();
    open?.textarea.remove();
    open = null;
  };

  const commit = () => {
    const placement = store.getState().textEdit;
    const typed = open?.textarea.value ?? '';
    // Close first: removing the focused textarea must not re-enter commit through blur.
    close();
    store.setState({ textEdit: null });
    if (document.activeElement === null || document.activeElement === document.body) {
      canvas.focus();
    }
    const shape = placement === null ? null : createTextShape(placement, typed, options.measurer);
    if (shape !== null) {
      const result = executeCommand(store, createShapeCommand(shape));
      if (!result.ok) {
        options.reportError(result.error);
      }
    }
  };

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.textEdit !== null && previous.textEdit === null) {
      open = openTextarea(options, state.textEdit, commit);
    } else if (state.textEdit === null && open !== null) {
      close();
    }
    if (open !== null && state.textEdit !== null && state.camera !== previous.camera) {
      placeTextarea(open.textarea, canvas, state.textEdit, state.camera, options.measurer);
    }
  });

  return () => {
    unsubscribe();
    close();
  };
}

function openTextarea(
  options: TextEditorOptions,
  placement: TextPlacement,
  commit: () => void,
): { textarea: HTMLTextAreaElement; abort: AbortController } {
  const { canvas, store, measurer } = options;
  const textarea = document.createElement('textarea');
  const abort = new AbortController();
  textarea.className = options.className;
  textarea.setAttribute('aria-label', 'Text');
  textarea.rows = 1;
  textarea.spellcheck = false;
  textarea.style.color = DEFAULT_SHAPE_STYLE.strokeColor;
  placeTextarea(textarea, canvas, placement, store.getState().camera, measurer);

  const { signal } = abort;
  textarea.addEventListener(
    'input',
    () => {
      // Grow with the content so the box never scrolls.
      textarea.style.height = 'auto';
      textarea.style.height = `${String(textarea.scrollHeight)}px`;
    },
    { signal },
  );
  textarea.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        commit();
      }
    },
    { signal },
  );
  textarea.addEventListener('blur', commit, { signal });

  canvas.after(textarea);
  textarea.focus();
  return { textarea, abort };
}

/** Matches the canvas: same font, size, line height, and wrap width at the current zoom. */
function placeTextarea(
  textarea: HTMLTextAreaElement,
  canvas: HTMLCanvasElement,
  placement: TextPlacement,
  camera: Camera,
  measurer: TextMeasurer,
): void {
  const screen = worldToScreen(camera, placement);
  const { lineHeight } = measurer.metrics(DEFAULT_FONT_SIZE);
  const style = textarea.style;
  style.left = `${String(canvas.offsetLeft + screen.x)}px`;
  style.top = `${String(canvas.offsetTop + screen.y)}px`;
  style.width = `${String(DEFAULT_TEXT_WIDTH * camera.zoom)}px`;
  // `font` resets line-height, so it must be set first.
  style.font = fontString(DEFAULT_FONT_SIZE * camera.zoom);
  style.lineHeight = `${String(lineHeight * camera.zoom)}px`;
}
