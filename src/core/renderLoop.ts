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

/** Draws only when something is dirty: an idle editor schedules no frames at all. */
export function createRenderLoop(draw: () => void, scheduler: FrameScheduler): RenderLoop {
  let pendingFrame: number | null = null;
  let disposed = false;

  const runFrame = () => {
    // Cleared before drawing, so a change made during draw schedules the next frame.
    pendingFrame = null;
    draw();
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
