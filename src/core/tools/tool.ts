import type { Point } from '../geometry/point';

export type ToolPointerEvent = {
  /**
   * Pointer position in screen space (CSS pixels from the canvas's top-left).
   * The same object is reused for every event: copy anything you need to keep.
   */
  readonly screen: Readonly<Point>;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  /** ⌘ on macOS. Where the PRD says "Ctrl", tools accept either. */
  readonly metaKey: boolean;
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
  /** Pointer moves with no button pressed, so the tool can update its cursor. */
  hover(event: ToolPointerEvent): void;
  /** Ends the gesture and leaves the document as it was before it. Safe to call when idle. */
  cancel(): void;
};
