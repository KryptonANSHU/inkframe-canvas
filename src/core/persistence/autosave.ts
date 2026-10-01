import type { DocumentState } from '../document';
import type { Result } from '../result';
import type { Shape } from '../shapes';
import type { EditorStore } from '../store';
import { documentFromShapes, toFile, type FileError } from './fileFormat';

/** One saved copy of the drawing. `file` is the same JSON a saved file holds. */
export type Snapshot = {
  /** Goes up by one with every save, so the newest snapshot is always clear. */
  readonly counter: number;
  readonly savedAt: number;
  readonly file: string;
};

/** Where snapshots live (IndexedDB in the browser, memory in tests). */
export type SnapshotStorage = {
  load(): Promise<{ readonly current: Snapshot | null; readonly backup: Snapshot | null }>;
  /**
   * Stores `snapshot` as current and the old current as backup, in one transaction:
   * a save cut short leaves the last complete snapshot in place.
   */
  save(snapshot: Snapshot): Promise<void>;
};

/** Parses and validates file text; the editor runs this in a worker. */
export type ReadFileText = (text: string) => Promise<Result<Shape[], FileError>>;

/** Quiet time after the last change before saving (PRD 1D). */
export const AUTOSAVE_DELAY_MS = 500;

export type PersistenceOptions = {
  readonly store: EditorStore;
  readonly storage: SnapshotStorage;
  readonly readFileText: ReadFileText;
  readonly reportError: (error: Error) => void;
  readonly delayMs?: number;
};

export type Persistence = {
  /** Saves now if a save is pending, e.g. when the tab is hidden. */
  flush(): Promise<void>;
  dispose(): void;
};

/**
 * Restores the last autosaved drawing (falling back to the backup), then saves every
 * document change after a quiet period. If storage fails, the status becomes
 * 'unavailable' and the editor keeps working in memory.
 */
export function startPersistence(options: PersistenceOptions): Persistence {
  const { store, storage, reportError } = options;
  const delay = options.delayMs ?? AUTOSAVE_DELAY_MS;
  let counter = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let saving: Promise<void> = Promise.resolve();
  let disposed = false;
  let unsubscribe: () => void = () => undefined;

  const save = (document: DocumentState) => {
    counter += 1;
    const snapshot: Snapshot = {
      counter,
      savedAt: Date.now(),
      file: JSON.stringify(toFile(document)),
    };
    // Saves run one after another, so an older snapshot never lands after a newer one.
    saving = saving
      .then(() => storage.save(snapshot))
      .catch((cause: unknown) => {
        markUnavailable(store, reportError, cause);
      });
    return saving;
  };
  const flush = () => {
    if (timer === null) {
      return saving;
    }
    clearTimeout(timer);
    timer = null;
    return save(store.getState().document);
  };

  void restore(options, () => !disposed).then((latest) => {
    if (disposed) {
      return;
    }
    counter = latest;
    if (store.getState().autosave === 'starting') {
      store.setState({ autosave: 'on' });
    }
    unsubscribe = store.subscribe((state, previous) => {
      if (state.document !== previous.document && state.autosave === 'on') {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => void flush(), delay);
      }
    });
  });

  return {
    flush,
    dispose() {
      disposed = true;
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    },
  };
}

/**
 * Loads the newest readable snapshot into the store. Returns the highest counter seen,
 * so new saves continue from it.
 */
async function restore(options: PersistenceOptions, active: () => boolean): Promise<number> {
  const { store, storage, readFileText, reportError } = options;
  let saved;
  try {
    saved = await storage.load();
  } catch (cause) {
    markUnavailable(store, reportError, cause);
    return 0;
  }
  const latest = Math.max(saved.current?.counter ?? 0, saved.backup?.counter ?? 0);
  for (const snapshot of [saved.current, saved.backup]) {
    if (snapshot === null) {
      continue;
    }
    const read = await readFileText(snapshot.file);
    if (!active()) {
      return latest;
    }
    if (read.ok) {
      // Anything drawn while loading wins: the snapshot would overwrite it.
      if (store.getState().document.order.length === 0) {
        store.setState({ document: documentFromShapes(read.value) });
      }
      return latest;
    }
  }
  if (saved.current !== null) {
    reportError(
      new Error(
        "Your autosaved drawing couldn't be opened, so Inkframe started with an empty canvas.",
      ),
    );
  }
  return latest;
}

function markUnavailable(
  store: EditorStore,
  reportError: (error: Error) => void,
  cause: unknown,
): void {
  if (store.getState().autosave !== 'unavailable') {
    store.setState({ autosave: 'unavailable' });
    reportError(
      new Error('Autosave is off: this browser is not letting Inkframe store data.', { cause }),
    );
  }
}
