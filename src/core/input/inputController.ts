import type { Point } from '../geometry/point';
import { nudgeSelection } from '../selection/selectedShapes';
import { EMPTY_SELECTION, type EditorStore } from '../store';
import type { Tool, ToolPointerEvent } from '../tools/tool';
import { TOOL_SHORTCUTS, type ToolId } from '../tools/toolIds';
import { applyWheel, type WheelInput } from './wheel';

export type PointerInput = ToolPointerEvent & { readonly pointerId: number };

export type KeyInput = {
  /** KeyboardEvent.key, e.g. ' ', 'Escape', 'r'. */
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
};

/** Arrow keys nudge the selection by 1 world unit, or 10 with Shift (PRD 1C). */
const NUDGE: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
const SHIFT_NUDGE_FACTOR = 10;

/**
 * Turns raw input into tool gestures. DOM-free, so the whole input path
 * (pointer → tool → command → store) is testable without a browser.
 */
export type InputController = {
  /** Returns true when a gesture started, so the caller should capture the pointer. */
  pointerDown(input: PointerInput): boolean;
  pointerMove(input: PointerInput): void;
  pointerUp(input: PointerInput): void;
  /** pointercancel, lost pointer capture, or Escape: the gesture leaves no trace. */
  cancelGesture(): void;
  /** Returns true when the key was handled, so the caller should preventDefault. */
  keyDown(input: KeyInput): boolean;
  keyUp(key: string): void;
  /** Window blur: keys may be released elsewhere, so forget them and cancel. */
  releaseAll(): void;
  wheel(input: WheelInput, anchor: Readonly<Point>): void;
  cursor(): string;
};

export type ControllerTools = {
  readonly byId: Readonly<Record<ToolId, Tool>>;
  readonly pan: Tool;
};

export function createInputController(
  store: EditorStore,
  tools: ControllerTools,
  reportError: (error: Error) => void,
): InputController {
  let spaceHeld = false;
  // The tool is locked in at pointerdown, so releasing space mid-pan doesn't switch tools.
  let gesture: { readonly pointerId: number; readonly tool: Tool } | null = null;

  const toolForNextGesture = () =>
    spaceHeld ? tools.pan : tools.byId[store.getState().activeTool];

  const cancelGesture = () => {
    const cancelled = gesture;
    gesture = null;
    cancelled?.tool.cancel();
  };

  // Leaves browser and OS shortcuts (Ctrl/Cmd/Alt + key) alone, and never switches
  // tools in the middle of a gesture.
  const switchToolByShortcut = (input: KeyInput) => {
    const tool = TOOL_SHORTCUTS[input.key.toLowerCase()];
    if (tool === undefined || gesture !== null || input.ctrlKey || input.metaKey || input.altKey) {
      return false;
    }
    store.setState({ activeTool: tool });
    return true;
  };

  const nudge = (input: KeyInput) => {
    const direction = NUDGE[input.key];
    if (
      direction === undefined ||
      gesture !== null ||
      input.ctrlKey ||
      input.metaKey ||
      input.altKey
    ) {
      return false;
    }
    const step = input.shiftKey ? SHIFT_NUDGE_FACTOR : 1;
    nudgeSelection(store, direction[0] * step, direction[1] * step, reportError);
    // Claimed even with nothing selected, so arrow keys never scroll the page.
    return true;
  };

  const escape = () => {
    if (gesture !== null) {
      cancelGesture();
      return true;
    }
    if (store.getState().selectedIds.size > 0) {
      store.setState({ selectedIds: EMPTY_SELECTION });
      return true;
    }
    return false;
  };

  return {
    pointerDown(input) {
      // One gesture at a time; multi-touch pan and zoom arrive in M4.
      if (gesture !== null) {
        return false;
      }
      gesture = { pointerId: input.pointerId, tool: toolForNextGesture() };
      gesture.tool.pointerDown(input);
      return true;
    },
    pointerMove(input) {
      if (gesture === null) {
        toolForNextGesture().hover(input);
      } else if (gesture.pointerId === input.pointerId) {
        gesture.tool.pointerMove(input);
      }
    },
    pointerUp(input) {
      if (gesture?.pointerId !== input.pointerId) {
        return;
      }
      const { tool } = gesture;
      gesture = null;
      tool.pointerUp(input);
    },
    cancelGesture,
    keyDown(input) {
      if (input.key === ' ') {
        spaceHeld = true;
        return true;
      }
      if (input.key === 'Escape') {
        return escape();
      }
      return nudge(input) || switchToolByShortcut(input);
    },
    keyUp(key) {
      if (key === ' ') {
        spaceHeld = false;
      }
    },
    releaseAll() {
      spaceHeld = false;
      cancelGesture();
    },
    wheel(input, anchor) {
      store.setState({ camera: applyWheel(store.getState().camera, input, anchor) });
    },
    cursor: () => (gesture?.tool ?? toolForNextGesture()).getCursor(),
  };
}
