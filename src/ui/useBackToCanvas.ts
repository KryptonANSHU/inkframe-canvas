import type { MouseEvent } from 'react';
import { useEditor } from './EditorContext';

/**
 * Wraps a control's action so a pointer click hands focus back to the canvas, keeping
 * shortcuts working; keyboard activation (detail 0) leaves focus where it is.
 */
export function useBackToCanvas() {
  const editor = useEditor();
  return (action: () => void) => (event: MouseEvent) => {
    action();
    if (event.detail > 0) editor.focus();
  };
}
