import type { Command } from './commands';
import type { ShapeId } from './shapes';

/** One undo step: a command and the selection on either side of it. */
export type HistoryEntry = {
  readonly command: Command;
  readonly selectionBefore: ReadonlySet<ShapeId>;
  readonly selectionAfter: ReadonlySet<ShapeId>;
  /** Entries with the same key may be joined into one step (see HistoryGroup). */
  readonly groupKey: string | null;
};

/** `past` ends with the most recent step; `future` ends with the next step to redo. */
export type History = {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
  /**
   * Counts new steps (joined commands don't count). Shared undo while collaborating
   * reads it to know where one undo step ends and the next begins.
   */
  readonly steps: number;
};

/**
 * Joins a command to the previous step instead of adding one, e.g. a held arrow key:
 * the first press starts the step (`continues: false`), its repeats extend it.
 */
export type HistoryGroup = { readonly key: string; readonly continues: boolean };

export const EMPTY_HISTORY: History = { past: [], future: [], steps: 0 };

/** Oldest steps are dropped past this, so a long session can't grow memory forever. */
export const MAX_HISTORY = 200;

/** Records a new step. Anything that was undone can no longer be redone. */
export function pushHistory(
  history: History,
  entry: HistoryEntry,
  group: HistoryGroup | null,
): History {
  const last = history.past.at(-1);
  if (group?.continues === true && last?.groupKey === group.key) {
    const joined: HistoryEntry = {
      command: chain(last.command, entry.command),
      selectionBefore: last.selectionBefore,
      selectionAfter: entry.selectionAfter,
      groupKey: group.key,
    };
    return { past: [...history.past.slice(0, -1), joined], future: [], steps: history.steps };
  }
  return {
    past: [...history.past, entry].slice(-MAX_HISTORY),
    future: [],
    steps: history.steps + 1,
  };
}

/** `first` then `second`, undone in reverse order, as one command. */
function chain(first: Command, second: Command): Command {
  return {
    label: second.label,
    do: (document) => second.do(first.do(document)),
    undo: (document) => first.undo(second.undo(document)),
  };
}
