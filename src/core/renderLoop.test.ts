import { describe, expect, it, vi } from 'vitest';
import { createRenderLoop, type FrameScheduler } from './renderLoop';
import { createEditorStore } from './store';
import { makeRect, testShapeId } from './testing/factories';

/** A scheduler whose frames run only when the test calls flush(). */
function createManualScheduler() {
  const callbacks = new Map<number, () => void>();
  let nextHandle = 1;
  const scheduler: FrameScheduler = {
    request(callback) {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    },
    cancel(handle) {
      callbacks.delete(handle);
    },
  };
  const flush = () => {
    const due = [...callbacks.values()];
    callbacks.clear();
    due.forEach((callback) => {
      callback();
    });
  };
  return { scheduler, flush, pendingCount: () => callbacks.size };
}

describe('createRenderLoop', () => {
  it('draws once for ten store changes in the same frame', () => {
    const { scheduler, flush } = createManualScheduler();
    const draw = vi.fn();
    const loop = createRenderLoop(draw, scheduler);
    const store = createEditorStore();
    store.subscribe(loop.invalidate);

    for (let i = 0; i < 10; i++) {
      store.setState({ draft: makeRect({ id: testShapeId(`draft-${String(i)}`) }) });
    }
    flush();

    expect(draw).toHaveBeenCalledTimes(1);
  });

  it('schedules no frames while idle', () => {
    const { scheduler, flush, pendingCount } = createManualScheduler();
    const draw = vi.fn();
    createRenderLoop(draw, scheduler);
    flush();
    expect(pendingCount()).toBe(0);
    expect(draw).not.toHaveBeenCalled();
  });

  it('schedules a new frame for a change made after the last draw', () => {
    const { scheduler, flush } = createManualScheduler();
    const draw = vi.fn();
    const loop = createRenderLoop(draw, scheduler);
    loop.invalidate();
    flush();
    loop.invalidate();
    flush();
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it('schedules the next frame when a draw itself invalidates', () => {
    const { scheduler, flush, pendingCount } = createManualScheduler();
    const loop = createRenderLoop(() => {
      loop.invalidate();
    }, scheduler);
    loop.invalidate();
    flush();
    expect(pendingCount()).toBe(1);
  });

  it('cancels the pending frame and ignores changes after dispose', () => {
    const { scheduler, flush, pendingCount } = createManualScheduler();
    const draw = vi.fn();
    const loop = createRenderLoop(draw, scheduler);
    loop.invalidate();
    loop.dispose();
    loop.invalidate();
    flush();
    expect(pendingCount()).toBe(0);
    expect(draw).not.toHaveBeenCalled();
  });
});
