import { useEffect, useRef } from 'react';
import { createEditor } from '../core/dom/createEditor';
import styles from './CanvasHost.module.css';
import { reportError } from './reportError';

/** Owns the one <canvas>: hands it to the editor core on mount, disposes it on unmount. */
export function CanvasHost() {
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
    return () => {
      editor.dispose();
    };
  }, []);

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
