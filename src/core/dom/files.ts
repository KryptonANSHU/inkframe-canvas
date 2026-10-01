import { executeCommand, replaceDocumentCommand } from '../commands';
import { exportBounds, shapesToExport } from '../export/exportArea';
import {
  documentFromShapes,
  fileTooLarge,
  MAX_FILE_BYTES,
  toFile,
} from '../persistence/fileFormat';
import type { Shape } from '../shapes';
import { EMPTY_SELECTION, type EditorStore } from '../store';
import type { TextMeasurer } from '../text/layout';
import { remeasured } from '../text/textShape';
import { whenFontsReady } from '../text/whenFontsReady';
import type { ExportFormat } from '../../workers/exportProtocol';
import { downloadBlob } from './download';
import type { ExportClient } from './exportClient';
import type { FileReaderClient } from './fileWorkerClient';

export type FileActions = {
  /** Shows the file picker. */
  open(): void;
  /** Downloads the drawing as Inkframe JSON. */
  save(): void;
  /** The selection, or the whole drawing when nothing is selected, as PNG or SVG. */
  exportImage(format: ExportFormat): Promise<void>;
  /** Opens a file the user picked or dropped. Errors land in `fileStatus`. */
  openFile(file: File): Promise<void>;
  dismissStatus(): void;
};

export type FileActionsOptions = {
  readonly store: EditorStore;
  readonly reader: FileReaderClient;
  readonly exporter: ExportClient;
  readonly measurer: TextMeasurer;
  readonly reportError: (error: Error) => void;
};

/**
 * Open and Save for whole drawings as versioned JSON, and PNG / SVG export. Opening
 * replaces the drawing as one undo step, so a file opened by mistake is one
 * Ctrl / ⌘ + Z away from gone.
 */
export function createFileActions(options: FileActionsOptions): FileActions {
  const { store } = options;
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.json,application/json';
  picker.onchange = () => {
    const [file] = picker.files ?? [];
    // Cleared so picking the same file again still fires `change`.
    picker.value = '';
    if (file !== undefined) {
      void openFile(file);
    }
  };

  const openFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      store.setState({ fileStatus: { kind: 'error', message: fileTooLarge() } });
      return;
    }
    const busy = (progress: number | null) => {
      store.setState({ fileStatus: { kind: 'busy', label: `Opening ${file.name}`, progress } });
    };
    busy(null);
    const result = await options.reader.read(await file.text(), busy);
    if (!result.ok) {
      store.setState({ fileStatus: { kind: 'error', message: result.error.message } });
      return;
    }
    // Text heights in a file are untrusted; measure them again with the real font.
    whenFontsReady(store, () => {
      replaceDrawing(options, result.value, file.name);
    });
  };

  const exportImage = async (format: ExportFormat) => {
    const shapes = shapesToExport(store.getState());
    const area = exportBounds(shapes);
    if (area === null) {
      const message = 'There is nothing to export yet. Draw something first.';
      store.setState({ fileStatus: { kind: 'error', message } });
      return;
    }
    const label = `Exporting ${format.toUpperCase()}`;
    store.setState({ fileStatus: { kind: 'busy', label, progress: null } });
    const result = await options.exporter.render(format, shapes, area);
    if (result.ok) {
      store.setState({ fileStatus: { kind: 'idle' } });
      downloadBlob(result.value, `${drawingName()}.${format}`);
    } else {
      store.setState({ fileStatus: { kind: 'error', message: result.error.message } });
    }
  };

  return {
    exportImage,
    open: () => {
      picker.click();
    },
    save: () => {
      const json = JSON.stringify(toFile(store.getState().document));
      downloadBlob(new Blob([json], { type: 'application/json' }), `${drawingName()}.json`);
    },
    openFile,
    dismissStatus: () => {
      store.setState({ fileStatus: { kind: 'idle' } });
    },
  };
}

function replaceDrawing(options: FileActionsOptions, shapes: readonly Shape[], name: string) {
  const { store, measurer, reportError } = options;
  const measured = shapes.flatMap((shape) => {
    const kept = shape.type === 'text' ? remeasured(shape, measurer) : shape;
    return kept === null ? [] : [kept];
  });
  const before = store.getState().document;
  const command = replaceDocumentCommand(`Open ${name}`, before, documentFromShapes(measured));
  const result = executeCommand(store, command, { select: EMPTY_SELECTION });
  store.setState({ fileStatus: { kind: 'idle' } });
  if (!result.ok) {
    reportError(result.error);
  }
}

/** "inkframe-2026-10-01", in the user's local date. */
export function drawingName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `inkframe-${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
