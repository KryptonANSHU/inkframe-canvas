import type { Point } from '../geometry/point';

export type ToolPointerEvent = {
  /**
   * Pointer position in screen space (CSS pixels from the canvas's top-left).
   * The same object is reused for every event: copy anything you need to keep.
   */
  readonly screen: Readonly<Point>;
};

/**
 * A tool is a small state machine: idle → pressing → dragging → idle.
 * The input controller sends it one gesture at a time.
 */
export type Tool = {
  getCursor(): string;
  pointerDown(event: ToolPointerEvent): void;
  pointerMove(event: ToolPointerEvent): void;
  pointerUp(event: ToolPointerEvent): void;
  /** Ends the gesture and leaves the document as it was before it. Safe to call when idle. */
  cancel(): void;
};
