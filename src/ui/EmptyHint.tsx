import { useEditorState } from './EditorContext';
import styles from './EmptyHint.module.css';
import { Kbd } from './Kbd';

/** One helpful line on an empty canvas (CLAUDE.md §8). It never blocks the pointer. */
export function EmptyHint() {
  const empty = useEditorState(
    (state) =>
      state.autosave !== 'starting' &&
      state.document.order.length === 0 &&
      state.draft === null &&
      state.textEdit === null,
  );
  if (!empty) {
    return null;
  }
  return (
    <p className={styles.hint}>
      Pick a tool or press <Kbd shortcut="R" /> to draw a rectangle.
    </p>
  );
}
