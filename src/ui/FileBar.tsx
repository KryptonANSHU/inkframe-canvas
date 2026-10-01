import { useStore } from 'zustand';
import type { Editor } from '../core/dom/createEditor';
import styles from './FileBar.module.css';

type FileBarProps = { readonly editor: Editor };

/**
 * Open and Save until the M7 toolbar's file menu replaces it. Shows progress while a
 * file opens, and why it couldn't be opened.
 */
export function FileBar({ editor }: FileBarProps) {
  const status = useStore(editor.store, (state) => state.fileStatus);
  // Focus goes back to the canvas afterwards, so shortcuts keep working.
  const run = (action: () => unknown) => () => {
    void action();
    editor.focus();
  };
  const { files } = editor;
  return (
    <div className={styles.bar}>
      <div className={styles.buttons} role="toolbar" aria-label="File">
        <button
          type="button"
          className={styles.button}
          onClick={run(() => {
            files.open();
          })}
        >
          Open…
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={run(() => {
            files.save();
          })}
        >
          Save as JSON
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={run(() => files.exportImage('png'))}
        >
          Export PNG
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={run(() => files.exportImage('svg'))}
        >
          Export SVG
        </button>
      </div>
      {status.kind === 'busy' && (
        <p className={styles.status} role="status">
          {status.label}
          {status.progress !== null && ` (${String(Math.round(status.progress * 100))}%)`}
        </p>
      )}
      {status.kind === 'error' && (
        <p className={styles.error} role="alert">
          {status.message}{' '}
          <button
            type="button"
            className={styles.button}
            onClick={run(() => {
              files.dismissStatus();
            })}
          >
            Dismiss
          </button>
        </p>
      )}
    </div>
  );
}
