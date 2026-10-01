import { useEffect, useRef } from 'react';
import { createEditor, type Editor } from '../core/dom/createEditor';
import styles from './CanvasHost.module.css';
import { reportError } from './reportError';

type CanvasHostProps = {
  /** Receives the editor once it exists, and null once it is disposed. */
  readonly onEditorChange: (editor: Editor | null) => void;
};

/** Owns the one <canvas>: hands it to the editor core on mount, disposes it on unmount. */
export function CanvasHost({ onEditorChange }: CanvasHostProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }
    const editor = createEditor(canvas, {
      reportError,
      textEditorClassName: styles.textEditor ?? '',
    });
    onEditorChange(editor);
    return () => {
      onEditorChange(null);
      editor.dispose();
    };
  }, [onEditorChange]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      // "application" tells screen readers this region handles its own keys. ARIA expects
      // application elements to be focusable; jsx-a11y classes the role as non-interactive.
      // eslint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role
      role="application"
      aria-label="Drawing canvas"
      tabIndex={0}
    />
  );
}
