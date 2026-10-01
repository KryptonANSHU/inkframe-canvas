/** Shapes of benchmark results, shared by the page-side driver and the Node runner. */

/** Median, 95th percentile, and worst of a set of samples. */
export type Stats = {
  readonly median: number;
  readonly p95: number;
  readonly max: number;
  readonly count: number;
};

/** Frame timings: time spent drawing, and time between drawn frames (1000 / fps). */
export type FrameStats = { readonly drawMs: Stats; readonly intervalMs: Stats };

export type FileTimes = {
  readonly saveMs: number;
  readonly openMs: number;
  readonly pngMs: number;
  readonly svgMs: number;
};

export type BenchApi = {
  load(count: number): Promise<{ buildMs: number; firstFrameMs: number }>;
  /**
   * A new camera every frame: 'pan' and 'zoom' with the whole drawing on screen,
   * 'pan100' at 100% zoom, where only part of it is (normal use).
   */
  animate(kind: 'pan' | 'zoom' | 'pan100', frames: number): Promise<FrameStats>;
  /** Drags `count` selected shapes with one pointer move per frame, through the select tool. */
  drag(count: number, frames: number): Promise<FrameStats>;
  /** Microseconds per hit test, averaged over batches of 100 random points. */
  hitTestMicros(batches: number): Stats;
  fileTimes(): Promise<FileTimes>;
  editSession(
    minutes: number,
  ): Promise<{ heapBeforeMB: number; heapAfterMB: number; edits: number }>;
};
