import { CircleQuestionMark, Redo2, Undo2 } from 'lucide-react';
import { Divider, IconButton, Surface } from '@inkframe/design';
import { useEditor, useEditorState } from './EditorContext';
import styles from './HistoryControls.module.css';
import { useBackToCanvas } from './useBackToCanvas';

/** Undo, redo, and the shortcuts dialog, bottom right. */
export function HistoryControls() {
  const editor = useEditor();
  const backToCanvas = useBackToCanvas();
  const { canUndo, canRedo } = useEditorState((state) => ({
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
  }));
  return (
    <Surface layout="bar" className={styles.place} role="group" aria-label="History">
      <IconButton
        label="Undo"
        Icon={Undo2}
        shortcut="Mod+Z"
        disabled={!canUndo}
        onClick={backToCanvas(() => {
          editor.perform('undo');
        })}
      />
      <IconButton
        label="Redo"
        Icon={Redo2}
        shortcut="Mod+Shift+Z"
        disabled={!canRedo}
        onClick={backToCanvas(() => {
          editor.perform('redo');
        })}
      />
      <Divider />
      <IconButton
        label="Keyboard shortcuts"
        Icon={CircleQuestionMark}
        shortcut="?"
        onClick={backToCanvas(() => {
          editor.perform('help');
        })}
      />
    </Surface>
  );
}
