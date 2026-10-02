import { insertShape, removeShape, replaceShapes, type DocumentState } from './document';
import { pushHistory, type HistoryEntry, type HistoryGroup } from './history';
import type { Result } from './result';
import type { Shape, ShapeId } from './shapes';
import type { EditorStore } from './store';

/**
 * A reversible document change. `do` and `undo` are pure: they build and return
 * a new document and never mutate their input, so a command that throws leaves
 * nothing half-applied.
 */
export type Command = {
  /** Shown to the user, e.g. in the undo history. */
  readonly label: string;
  do(document: DocumentState): DocumentState;
  undo(document: DocumentState): DocumentState;
};

export class CommandError extends Error {
  override readonly name = 'CommandError';

  constructor(label: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`${label} failed: ${reason}`, { cause });
  }
}

/** Puts a new shape on top of the draw order. */
export function createShapeCommand(shape: Shape): Command {
  return {
    label: 'Create shape',
    do: (document) => insertShape(document, { ...shape, zIndex: document.order.length }),
    undo: (document) => removeShape(document, shape.id),
  };
}

/**
 * Swaps the whole document, e.g. for an opened file. Undo brings the old drawing
 * back, so opening a file by mistake loses nothing.
 */
export function replaceDocumentCommand(
  label: string,
  before: DocumentState,
  after: DocumentState,
): Command {
  return { label, do: () => after, undo: () => before };
}

/**
 * Puts new shapes on top of the draw order, keeping their order among themselves
 * (the first ends up lowest). Used for duplicate and paste.
 */
export function createShapesCommand(label: string, shapes: readonly Shape[]): Command {
  return {
    label,
    do: (document) =>
      shapes.reduce(
        (next, shape) => insertShape(next, { ...shape, zIndex: next.order.length }),
        document,
      ),
    undo: (document) => shapes.reduce((next, shape) => removeShape(next, shape.id), document),
  };
}

/**
 * Removes shapes. Undo puts each back at its old place in the draw order: inserting
 * from the bottom up means every zIndex is valid when its shape goes back in.
 */
export function deleteShapesCommand(label: string, shapes: readonly Shape[]): Command {
  const bottomUp = shapes.toSorted((a, b) => a.zIndex - b.zIndex);
  return {
    label,
    do: (document) => bottomUp.reduce((next, shape) => removeShape(next, shape.id), document),
    undo: (document) => bottomUp.reduce((next, shape) => insertShape(next, shape), document),
  };
}

/**
 * Replaces shapes with new versions of themselves: moves, resizes, rotations, nudges,
 * text edits. `before` and `after` must list the same shapes; undo puts `before` back.
 */
export function updateShapesCommand(
  label: string,
  before: readonly Shape[],
  after: readonly Shape[],
): Command {
  const beforeIds = before.map((shape) => shape.id).sort();
  const afterIds = after.map((shape) => shape.id).sort();
  if (beforeIds.join('\n') !== afterIds.join('\n')) {
    throw new Error(`${label}: "before" and "after" must list the same shapes.`);
  }
  return {
    label,
    do: (document) => replaceShapes(document, after),
    undo: (document) => replaceShapes(document, before),
  };
}

/** Several commands as one step: done in order, undone in reverse. */
export function sequenceCommand(label: string, commands: readonly Command[]): Command {
  return {
    label,
    do: (document) => commands.reduce((next, command) => command.do(next), document),
    undo: (document) => commands.reduceRight((next, command) => command.undo(next), document),
  };
}

export type ExecuteOptions = {
  /** The selection once the command has run; defaults to the current one. */
  readonly select?: ReadonlySet<ShapeId>;
  /** Joins this command to the previous undo step (see HistoryGroup). */
  readonly group?: HistoryGroup;
};

/**
 * Runs a command against the store and records it as an undo step. The new document
 * is built first and stored in one step, together with the selection and history; if
 * building it throws, the store is untouched and the error is returned.
 */
export function executeCommand(
  store: EditorStore,
  command: Command,
  options: ExecuteOptions = {},
): Result<DocumentState, CommandError> {
  const state = store.getState();
  const result = tryRun(() => command.do(state.document), command.label);
  if (result.ok) {
    const entry: HistoryEntry = {
      command,
      selectionBefore: state.selectedIds,
      selectionAfter: options.select ?? state.selectedIds,
      groupKey: options.group?.key ?? null,
    };
    store.setState({
      document: result.value,
      selectedIds: entry.selectionAfter,
      history: pushHistory(state.history, entry, options.group ?? null),
    });
  }
  return result;
}

/**
 * Undoes the most recent step and restores the selection from before it. Returns
 * null when there is nothing to undo.
 */
export function undo(store: EditorStore): Result<DocumentState, CommandError> | null {
  const { history, document } = store.getState();
  const entry = history.past.at(-1);
  if (entry === undefined) {
    return null;
  }
  const result = tryRun(() => entry.command.undo(document), `Undo ${entry.command.label}`);
  if (result.ok) {
    store.setState({
      document: result.value,
      selectedIds: entry.selectionBefore,
      history: {
        past: history.past.slice(0, -1),
        future: [...history.future, entry],
        steps: history.steps,
      },
    });
  }
  return result;
}

/** Redoes the most recently undone step and its selection. Null when there is none. */
export function redo(store: EditorStore): Result<DocumentState, CommandError> | null {
  const { history, document } = store.getState();
  const entry = history.future.at(-1);
  if (entry === undefined) {
    return null;
  }
  const result = tryRun(() => entry.command.do(document), `Redo ${entry.command.label}`);
  if (result.ok) {
    store.setState({
      document: result.value,
      selectedIds: entry.selectionAfter,
      history: {
        past: [...history.past, entry],
        future: history.future.slice(0, -1),
        steps: history.steps,
      },
    });
  }
  return result;
}

function tryRun(build: () => DocumentState, label: string): Result<DocumentState, CommandError> {
  try {
    return { ok: true, value: build() };
  } catch (error) {
    return { ok: false, error: new CommandError(label, error) };
  }
}
