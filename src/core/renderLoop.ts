/** requestAnimationFrame / cancelAnimationFrame, passed in so tests can step frames by hand. */
export type FrameScheduler = {
  request(callback: () => void): number;
  cancel(handle: number): void;
};

// Arrow-typed so `invalidate` can be passed straight to store.subscribe.
export type RenderLoop = {
  /** Marks the scene dirty. Any number of calls before the next frame cause one draw. */
  readonly invalidate: () => void;
  readonly dispose: () => void;
};

/**
 * Draws only when something is dirty: an idle editor schedules no frames at all.
 * A draw that throws is reported (each distinct error once, so a broken shape can't
 * flood the log), and the next change still draws: the canvas never fails silently.
 */
export function createRenderLoop(
  draw: () => void,
  scheduler: FrameScheduler,
  reportError: (error: Error) => void = () => undefined,
): RenderLoop {
  let pendingFrame: number | null = null;
  let disposed = false;
  const reported = new Set<string>();

  const runFrame = () => {
    // Cleared before drawing, so a change made during draw schedules the next frame.
    pendingFrame = null;
    try {
      draw();
    } catch (cause) {
      const error = new Error("Part of the canvas couldn't be drawn.", { cause });
      const key = cause instanceof Error ? cause.message : String(cause);
      if (!reported.has(key)) {
        reported.add(key);
        reportError(error);
      }
    }
  };

  return {
    invalidate: () => {
      if (pendingFrame === null && !disposed) {
        pendingFrame = scheduler.request(runFrame);
      }
    },
    dispose: () => {
      disposed = true;
      if (pendingFrame !== null) {
        scheduler.cancel(pendingFrame);
        pendingFrame = null;
      }
    },
  };
}
