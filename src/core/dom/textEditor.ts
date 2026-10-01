import { worldToScreen, type Camera } from '../camera';
import { DEFAULT_SHAPE_STYLE } from '../shapes';
import type { EditorStore } from '../store';
import { canvasTheme } from '../theme';
import { commitTextEdit } from '../text/commitTextEdit';
import { whenFontsReady } from '../text/whenFontsReady';
import { DEFAULT_FONT_SIZE, DEFAULT_TEXT_WIDTH, fontString } from '../text/font';
import type { TextMeasurer } from '../text/layout';
import type { TextEdit } from '../text/textShape';

export type TextEditorOptions = {
  readonly store: EditorStore;
  readonly canvas: HTMLCanvasElement;
  /** Static look of the textarea (no border, transparent, no resize), from the UI layer. */
  readonly className: string;
  readonly measurer: TextMeasurer;
  readonly reportError: (error: Error) => void;
};

/**
 * Opens a <textarea> over the canvas whenever the store gets a `textEdit` (new text or
 * an existing shape), keeps it aligned with the camera, and commits it as one command
 * on blur, Escape, or Ctrl/Cmd + Enter. Returns a function that removes it without
 * committing.
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
    const edit = store.getState().textEdit;
    const typed = open?.textarea.value ?? '';
    // Close first: removing the focused textarea must not re-enter commit through blur.
    close();
    store.setState({ textEdit: null });
    if (document.activeElement === null || document.activeElement === document.body) {
      // The user didn't move focus here, so no ring around the whole canvas.
      canvas.focus({ preventScroll: true, focusVisible: false });
    }
    if (edit !== null) {
      whenFontsReady(store, () => {
        commitTextEdit(store, edit, typed, options.measurer, options.reportError);
      });
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
  edit: TextEdit,
  commit: () => void,
): { textarea: HTMLTextAreaElement; abort: AbortController } {
  const { canvas, store, measurer } = options;
  const textarea = document.createElement('textarea');
  const abort = new AbortController();
  textarea.className = options.className;
  textarea.setAttribute('aria-label', 'Text');
  textarea.rows = 1;
  textarea.spellcheck = false;
  const stored = (edit.original?.style ?? DEFAULT_SHAPE_STYLE).strokeColor;
  textarea.style.color = canvasTheme(store.getState().theme).shapeColor(stored);
  textarea.value = edit.original?.text ?? '';
  placeTextarea(textarea, canvas, edit, store.getState().camera, measurer);

  // Grow with the content so the box never scrolls.
  const fitHeight = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${String(textarea.scrollHeight)}px`;
  };
  const { signal } = abort;
  textarea.addEventListener('input', fitHeight, { signal });
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
  fitHeight();
  textarea.focus();
  // Existing text opens with the caret at its end, ready to add to it.
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  return { textarea, abort };
}

/**
 * Matches the canvas: same font, size, line height, wrap width, and rotation at the
 * current zoom.
 */
function placeTextarea(
  textarea: HTMLTextAreaElement,
  canvas: HTMLCanvasElement,
  edit: TextEdit,
  camera: Camera,
  measurer: TextMeasurer,
): void {
  const fontSize = edit.original?.fontSize ?? DEFAULT_FONT_SIZE;
  const { lineHeight } = measurer.metrics(fontSize);
  const width = (edit.original?.width ?? DEFAULT_TEXT_WIDTH) * camera.zoom;
  const height = (edit.original?.height ?? lineHeight) * camera.zoom;
  const screen = worldToScreen(camera, edit);
  const style = textarea.style;
  style.left = `${String(canvas.offsetLeft + screen.x)}px`;
  style.top = `${String(canvas.offsetTop + screen.y)}px`;
  style.width = `${String(width)}px`;
  // `font` resets line-height, so it must be set first.
  style.font = fontString(fontSize * camera.zoom);
  style.lineHeight = `${String(lineHeight * camera.zoom)}px`;
  // Rotated text turns around its box center, as on the canvas.
  const rotation = edit.original?.rotation ?? 0;
  style.transformOrigin = `${String(width / 2)}px ${String(height / 2)}px`;
  style.transform = rotation === 0 ? '' : `rotate(${String(rotation)}rad)`;
}
