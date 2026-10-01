import { insertShape, removeShape, replaceShapes, type DocumentState } from './document';
import type { Result } from './result';
import type { Shape } from './shapes';
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

/**
 * Runs a command against the store. The new document is built first and stored in
 * one step; if building it throws, the store is untouched and the error is returned.
 * Undo history arrives in M5.
 */
export function executeCommand(
  store: EditorStore,
  command: Command,
): Result<DocumentState, CommandError> {
  const result = tryRun(() => command.do(store.getState().document), command.label);
  if (result.ok) {
    store.setState({ document: result.value });
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
