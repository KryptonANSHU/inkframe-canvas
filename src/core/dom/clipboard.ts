import { deleteSelection, type ShapeClipboard } from '../editActions';
import { documentFromShapes, FILE_FORMAT, toFile } from '../persistence/fileFormat';
import type { EditorStore } from '../store';
import type { FileReaderClient } from './fileWorkerClient';

export type ClipboardOptions = {
  readonly canvas: HTMLCanvasElement;
  readonly store: EditorStore;
  readonly clipboard: ShapeClipboard;
  readonly reader: FileReaderClient;
  readonly reportError: (error: Error) => void;
};

/**
 * Copy, cut, and paste through the system clipboard, so shapes paste into another tab.
 * Uses the browser's clipboard events (which grant access without a permission prompt)
 * while the canvas has focus. Copied shapes are an Inkframe file as text, and pasted
 * text goes through the same worker validation as opening a file.
 */
export function bindClipboard(options: ClipboardOptions): () => void {
  const { canvas, store, clipboard, reader, reportError } = options;
  const abort = new AbortController();
  const { signal } = abort;
  const ours = () => document.activeElement === canvas;

  const copy = (event: ClipboardEvent) => {
    const shapes = clipboard.copy(store);
    if (shapes.length === 0 || event.clipboardData === null) {
      return false;
    }
    event.preventDefault();
    event.clipboardData.setData('text/plain', JSON.stringify(toFile(documentFromShapes(shapes))));
    return true;
  };

  document.addEventListener(
    'copy',
    (event) => {
      if (ours()) copy(event);
    },
    { signal },
  );
  document.addEventListener(
    'cut',
    (event) => {
      if (ours() && copy(event)) deleteSelection(store, reportError);
    },
    { signal },
  );
  document.addEventListener(
    'paste',
    (event) => {
      const text = event.clipboardData?.getData('text/plain') ?? '';
      // Other text is left alone: pasting plain text as shapes isn't supported yet.
      if (!ours() || !text.includes(`"${FILE_FORMAT}"`)) {
        return;
      }
      event.preventDefault();
      void reader.read(text).then((result) => {
        if (result.ok) {
          clipboard.paste(store, result.value, reportError);
        } else {
          store.setState({ fileStatus: { kind: 'error', message: result.error.message } });
        }
      });
    },
    { signal },
  );
  return () => {
    abort.abort();
  };
}
