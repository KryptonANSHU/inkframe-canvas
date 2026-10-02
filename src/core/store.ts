import type { AnchorHint } from './attachments';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { DEFAULT_CAMERA, type Camera } from './camera';
import { EMPTY_DOCUMENT, type DocumentState } from './document';
import type { Bounds } from './geometry/bounds';
import type { ThemeName } from '../design/tokens';
import { EMPTY_HISTORY, type History } from './history';
import type { Shape, ShapeId } from './shapes';
import type { Guide } from './snapping';
import type { TextEdit } from './text/textShape';
import { DEFAULT_TOOL, type ToolId } from './tools/toolIds';

/** Opening or exporting a file: progress, or why it failed, for the file bar. */
export type FileStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy'; readonly label: string; readonly progress: number | null }
  | { readonly kind: 'error'; readonly message: string };

/** 'starting' until the autosaved drawing is restored; 'unavailable' if storage fails. */
export type AutosaveStatus = 'starting' | 'on' | 'unavailable';

export type EditorState = {
  readonly document: DocumentState;
  readonly camera: Camera;
  /**
   * The shape currently being drawn. It lives outside the document, so cancelling
   * a gesture only clears it and never has to undo a document change.
   */
  readonly draft: Shape | null;
  /** Selected shapes. Not part of the document, but undo and redo restore it. */
  readonly selectedIds: ReadonlySet<ShapeId>;
  /** Undo and redo steps. Only executeCommand, undo, and redo change it. */
  readonly history: History;
  /**
   * New versions of shapes being moved, resized, or rotated, drawn in place of the
   * document's versions until the gesture ends. Like `draft`, cancel just clears it.
   */
  readonly preview: ReadonlyMap<ShapeId, Shape> | null;
  /** The marquee being dragged, in world units. */
  readonly marquee: Bounds | null;
  /** Snap guides to draw while a move is snapped. Transient, like `preview`. */
  readonly guides: readonly Guide[];
  /** The tool the next gesture uses (unless space is held for panning). */
  readonly activeTool: ToolId;
  /** The text box being typed in (new or existing text), or null when not editing text. */
  readonly textEdit: TextEdit | null;
  /** False until the text font has loaded; text is neither drawn nor placed before then. */
  readonly fontsReady: boolean;
  readonly autosave: AutosaveStatus;
  readonly fileStatus: FileStatus;
  /** The theme the canvas draws in; follows the page (see dom/themeMode.ts). */
  readonly theme: ThemeName;
  /** Keeps the drawing tool after each shape instead of returning to select (Q). */
  readonly toolLocked: boolean;
  /** The keyboard shortcuts dialog (?). */
  readonly helpOpen: boolean;
  /** A grid behind the shapes (Ctrl / ⌘ + '); a view setting, never exported. */
  readonly gridVisible: boolean;
  /** Anchors to show while an arrow end is drawn or dragged near a shape. Transient. */
  readonly anchorHint: AnchorHint | null;
  /**
   * While collaborating, undo and redo act on the local user's own changes, through
   * the shared document; this mirrors what they can do. Null uses `history`.
   */
  readonly sharedUndo: { readonly canUndo: boolean; readonly canRedo: boolean } | null;
};

export type EditorStore = StoreApi<EditorState>;

export const EMPTY_SELECTION: ReadonlySet<ShapeId> = new Set();
export const NO_GUIDES: readonly Guide[] = [];

/** One store per editor instance, so tests and multiple editors never share state. */
export function createEditorStore(initial: Partial<EditorState> = {}): EditorStore {
  return createStore<EditorState>()(() => ({
    document: EMPTY_DOCUMENT,
    camera: DEFAULT_CAMERA,
    draft: null,
    selectedIds: EMPTY_SELECTION,
    history: EMPTY_HISTORY,
    preview: null,
    marquee: null,
    guides: NO_GUIDES,
    activeTool: DEFAULT_TOOL,
    textEdit: null,
    fontsReady: false,
    autosave: 'starting',
    fileStatus: { kind: 'idle' },
    theme: 'light',
    toolLocked: false,
    helpOpen: false,
    gridVisible: true,
    anchorHint: null,
    sharedUndo: null,
    ...initial,
  }));
}
