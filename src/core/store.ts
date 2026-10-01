import { createStore, type StoreApi } from 'zustand/vanilla';
import { DEFAULT_CAMERA, type Camera } from './camera';
import { EMPTY_DOCUMENT, type DocumentState } from './document';
import type { Shape } from './shapes';
import { DEFAULT_TOOL, type ToolId } from './tools/toolIds';

export type EditorState = {
  readonly document: DocumentState;
  readonly camera: Camera;
  /**
   * The shape currently being drawn. It lives outside the document, so cancelling
   * a gesture only clears it and never has to undo a document change.
   */
  readonly draft: Shape | null;
  /** The tool the next gesture uses (unless space is held for panning). */
  readonly activeTool: ToolId;
};

export type EditorStore = StoreApi<EditorState>;

/** One store per editor instance, so tests and multiple editors never share state. */
export function createEditorStore(initial: Partial<EditorState> = {}): EditorStore {
  return createStore<EditorState>()(() => ({
    document: EMPTY_DOCUMENT,
    camera: DEFAULT_CAMERA,
    draft: null,
    activeTool: DEFAULT_TOOL,
    ...initial,
  }));
}
