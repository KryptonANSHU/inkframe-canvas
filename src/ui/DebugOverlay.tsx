import { useEffect, useRef } from 'react';
import { useEditor, useEditorState } from './EditorContext';
import styles from './DebugOverlay.module.css';

/** Frames kept for the graph and the percentile: two seconds at 60 fps. */
const WINDOW = 120;
/** One frame at 60 fps: the line every bar should stay under. */
const BUDGET_MS = 1000 / 60;
/** The graph's top, so a frame that blew the budget twice over still fits. */
const GRAPH_MAX_MS = BUDGET_MS * 2;
const GRAPH_WIDTH = 240;
const GRAPH_HEIGHT = 48;

/**
 * FPS, draw time, and a frame-time graph, shown with ?debug=1. It
 * draws straight to its own canvas on each editor frame, so React never re-renders
 * per frame, and an idle editor leaves it still.
 */
export function DebugOverlay() {
  const editor = useEditor();
  const theme = useEditorState((state) => state.theme);
  const graph = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    const canvas = graph.current;
    const context = canvas?.getContext('2d');
    if (canvas === null || context === null || context === undefined) {
      return;
    }
    // Colors read once per theme, never per frame (a style read in the hot path).
    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim();
    const colors = {
      bar: color('--color-ink-muted'),
      over: color('--color-danger'),
      budget: color('--color-select'),
    };
    const dpr = window.devicePixelRatio;
    canvas.width = GRAPH_WIDTH * dpr;
    canvas.height = GRAPH_HEIGHT * dpr;
    context.scale(dpr, dpr);
    const drawTimes: number[] = [];
    const stamps: number[] = [];

    return editor.onFrame((drawMs) => {
      const now = performance.now();
      drawTimes.push(drawMs);
      stamps.push(now);
      if (drawTimes.length > WINDOW) drawTimes.shift();
      while (stamps.length > 0 && (stamps[0] ?? now) < now - 1000) stamps.shift();

      const sorted = drawTimes.toSorted((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? drawMs;
      const shapes = editor.store.getState().document.order.length;
      if (readout.current !== null) {
        readout.current.textContent =
          `${String(stamps.length)} fps · draw ${drawMs.toFixed(1)} ms · ` +
          `p95 ${p95.toFixed(1)} ms · ${shapes.toLocaleString('en')} shapes`;
      }

      context.clearRect(0, 0, GRAPH_WIDTH, GRAPH_HEIGHT);
      const barWidth = GRAPH_WIDTH / WINDOW;
      drawTimes.forEach((ms, i) => {
        const height = Math.min(ms / GRAPH_MAX_MS, 1) * GRAPH_HEIGHT;
        context.fillStyle = ms > BUDGET_MS ? colors.over : colors.bar;
        context.fillRect(
          i * barWidth,
          GRAPH_HEIGHT - height,
          Math.max(barWidth - 0.5, 0.5),
          height,
        );
      });
      const budgetY = GRAPH_HEIGHT - (BUDGET_MS / GRAPH_MAX_MS) * GRAPH_HEIGHT;
      context.fillStyle = colors.budget;
      context.fillRect(0, Math.round(budgetY), GRAPH_WIDTH, 1);
    });
  }, [editor, theme]);

  return (
    <section className={styles.overlay} aria-label="Performance">
      <output ref={readout} className={styles.readout}>
        Waiting for a frame…
      </output>
      <canvas
        ref={graph}
        className={styles.graph}
        width={GRAPH_WIDTH}
        height={GRAPH_HEIGHT}
        aria-hidden="true"
      />
    </section>
  );
}
