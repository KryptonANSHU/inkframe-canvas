import { CircleQuestionMark, Redo2, Undo2 } from 'lucide-react';
import { useEditor, useEditorState } from './EditorContext';
import styles from './HistoryControls.module.css';
import { IconButton } from './IconButton';

/** Undo, redo, and the shortcuts dialog, bottom right. */
export function HistoryControls() {
  const editor = useEditor();
  const { canUndo, canRedo } = useEditorState((state) => ({
    canUndo: state.history.past.length > 0,
    canRedo: state.history.future.length > 0,
  }));
  return (
    <div className={styles.history} role="group" aria-label="History">
      <IconButton
        label="Undo"
        Icon={Undo2}
        shortcut="Mod+Z"
        disabled={!canUndo}
        onClick={() => {
          editor.perform('undo');
        }}
      />
      <IconButton
        label="Redo"
        Icon={Redo2}
        shortcut="Mod+Shift+Z"
        disabled={!canRedo}
        onClick={() => {
          editor.perform('redo');
        }}
      />
      <span className={styles.divider} aria-hidden="true" />
      <IconButton
        label="Keyboard shortcuts"
        Icon={CircleQuestionMark}
        shortcut="?"
        onClick={() => {
          editor.perform('help');
        }}
      />
    </div>
  );
}
