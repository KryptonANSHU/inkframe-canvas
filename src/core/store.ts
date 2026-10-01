import { createStore, type StoreApi } from 'zustand/vanilla';
import { DEFAULT_CAMERA, type Camera } from './camera';
import { EMPTY_DOCUMENT, type DocumentState } from './document';
import type { Bounds } from './geometry/bounds';
import type { Shape, ShapeId } from './shapes';
import { DEFAULT_TOOL, type ToolId } from './tools/toolIds';

export type EditorState = {
  readonly document: DocumentState;
  readonly camera: Camera;
  /**
   * The shape currently being drawn. It lives outside the document, so cancelling
   * a gesture only clears it and never has to undo a document change.
   */
  readonly draft: Shape | null;
  /** Selected shapes. Not part of the document; undo restores it from M5. */
  readonly selectedIds: ReadonlySet<ShapeId>;
  /**
   * New versions of shapes being moved, resized, or rotated, drawn in place of the
   * document's versions until the gesture ends. Like `draft`, cancel just clears it.
   */
  readonly preview: ReadonlyMap<ShapeId, Shape> | null;
  /** The marquee being dragged, in world units. */
  readonly marquee: Bounds | null;
  /** The tool the next gesture uses (unless space is held for panning). */
  readonly activeTool: ToolId;
  /** Where a new text box is being typed (world point), or null when not editing text. */
  readonly textEdit: { readonly id: ShapeId; readonly x: number; readonly y: number } | null;
  /** False until the text font has loaded; text is neither drawn nor placed before then. */
  readonly fontsReady: boolean;
};

export type EditorStore = StoreApi<EditorState>;

export const EMPTY_SELECTION: ReadonlySet<ShapeId> = new Set();

/** One store per editor instance, so tests and multiple editors never share state. */
export function createEditorStore(initial: Partial<EditorState> = {}): EditorStore {
  return createStore<EditorState>()(() => ({
    document: EMPTY_DOCUMENT,
    camera: DEFAULT_CAMERA,
    draft: null,
    selectedIds: EMPTY_SELECTION,
    preview: null,
    marquee: null,
    activeTool: DEFAULT_TOOL,
    textEdit: null,
    fontsReady: false,
    ...initial,
  }));
}
