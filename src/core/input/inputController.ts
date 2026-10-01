import type { Point } from '../geometry/point';
import { nudgeSelection } from '../selection/selectedShapes';
import { EMPTY_SELECTION, type EditorStore } from '../store';
import type { Tool, ToolPointerEvent } from '../tools/tool';
import { TOOL_SHORTCUTS, type ToolId } from '../tools/toolIds';
import { createTouchTracker } from './pinch';
import { applyWheel, type WheelInput } from './wheel';

export type PointerInput = ToolPointerEvent & {
  readonly pointerId: number;
  /** PointerEvent.pointerType: 'mouse', 'pen', or 'touch'. */
  readonly pointerType: string;
};

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
 * Ctrl / ⌘ + key combos the editor owns, claimed now so the browser never bookmarks
 * (D) or saves the page (S). Duplicate arrives in M5 and save in M6.
 */
const EDITOR_SHORTCUTS = new Set(['d', 's']);

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
  doubleClick(input: ToolPointerEvent): void;
  /** True when the current gesture wants every coalesced pointer move, not one per frame. */
  wantsEveryMove(): boolean;
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
  const touches = createTouchTracker();
  const busy = () => gesture !== null || touches.pinching();

  const toolForNextGesture = () =>
    spaceHeld ? tools.pan : tools.byId[store.getState().activeTool];

  const cancelToolGesture = () => {
    const cancelled = gesture;
    gesture = null;
    cancelled?.tool.cancel();
  };
  const cancelGesture = () => {
    touches.reset();
    cancelToolGesture();
  };

  const startGesture = (input: PointerInput) => {
    if (busy()) {
      return false;
    }
    gesture = { pointerId: input.pointerId, tool: toolForNextGesture() };
    gesture.tool.pointerDown(input);
    return true;
  };
  // A second finger drops whatever the first one started, and the pair pans and zooms.
  const touchDown = (input: PointerInput) => {
    const role = touches.down(input.pointerId, input.screen, store.getState().camera);
    if (role === 'second') {
      cancelToolGesture();
      return true;
    }
    if (role === 'first' && startGesture(input)) {
      return true;
    }
    touches.up(input.pointerId);
    return false;
  };

  // Leaves browser and OS shortcuts (Ctrl/Cmd/Alt + key) alone, and never switches
  // tools in the middle of a gesture.
  const switchToolByShortcut = (input: KeyInput) => {
    const tool = TOOL_SHORTCUTS[input.key.toLowerCase()];
    if (tool === undefined || busy() || input.ctrlKey || input.metaKey || input.altKey) {
      return false;
    }
    store.setState({ activeTool: tool });
    return true;
  };

  const nudge = (input: KeyInput) => {
    const direction = NUDGE[input.key];
    if (direction === undefined || busy() || input.ctrlKey || input.metaKey || input.altKey) {
      return false;
    }
    const step = input.shiftKey ? SHIFT_NUDGE_FACTOR : 1;
    nudgeSelection(store, direction[0] * step, direction[1] * step, reportError);
    // Claimed even with nothing selected, so arrow keys never scroll the page.
    return true;
  };

  const claimEditorShortcut = (input: KeyInput) =>
    (input.ctrlKey || input.metaKey) &&
    !input.altKey &&
    EDITOR_SHORTCUTS.has(input.key.toLowerCase());

  const escape = () => {
    if (busy()) {
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
      // One gesture at a time, except that a second finger turns into a pinch.
      return input.pointerType === 'touch' ? touchDown(input) : startGesture(input);
    },
    pointerMove(input) {
      const camera = touches.move(input.pointerId, input.screen);
      if (camera !== null) {
        store.setState({ camera });
      } else if (touches.pinching()) {
        return;
      } else if (gesture === null) {
        toolForNextGesture().hover(input);
      } else if (gesture.pointerId === input.pointerId) {
        gesture.tool.pointerMove(input);
      }
    },
    pointerUp(input) {
      if (touches.up(input.pointerId) || gesture?.pointerId !== input.pointerId) {
        return;
      }
      const { tool } = gesture;
      gesture = null;
      tool.pointerUp(input);
    },
    cancelGesture,
    doubleClick(input) {
      if (!busy()) {
        toolForNextGesture().doubleClick?.(input);
      }
    },
    wantsEveryMove: () => gesture?.tool.wantsEveryMove === true,
    keyDown(input) {
      if (input.key === ' ') {
        spaceHeld = true;
        return true;
      }
      if (input.key === 'Escape') {
        return escape();
      }
      return claimEditorShortcut(input) || nudge(input) || switchToolByShortcut(input);
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
