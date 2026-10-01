import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Editor } from '../core/dom/createEditor';
import type { EditorState } from '../core/store';

const EditorContext = createContext<Editor | null>(null);

type EditorProviderProps = { readonly editor: Editor; readonly children: ReactNode };

/** Gives every control access to the editor without passing it down by hand. */
export function EditorProvider({ editor, children }: EditorProviderProps) {
  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
}

export function useEditor(): Editor {
  const editor = useContext(EditorContext);
  if (editor === null) {
    throw new Error('useEditor must be used inside <EditorProvider>.');
  }
  return editor;
}

/**
 * A slice of editor state. Re-renders only when the slice changes (compared shallowly,
 * so selectors may return fresh objects or arrays), never per shape or per frame.
 */
export function useEditorState<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditor().store, useShallow(selector));
}
