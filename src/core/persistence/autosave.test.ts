import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShapeCommand, executeCommand } from '../commands';
import { createEditorStore } from '../store';
import { makeRect, testShapeId } from '../testing/factories';
import { startPersistence, type Snapshot, type SnapshotStorage } from './autosave';
import { documentFromShapes, toFile } from './fileFormat';
import { readFileText } from './readFile';

const rect = makeRect({ id: testShapeId('saved') });
const savedFile = JSON.stringify(toFile(documentFromShapes([rect])));
const snapshot = (counter: number, file = savedFile): Snapshot => ({ counter, savedAt: 0, file });

/** In-memory storage with the same current → backup rotation as IndexedDB. */
function memoryStorage(initial: { current?: Snapshot; backup?: Snapshot } = {}) {
  let current = initial.current ?? null;
  let backup = initial.backup ?? null;
  const storage: SnapshotStorage = {
    load: () => Promise.resolve({ current, backup }),
    save: (next) => {
      backup = current;
      current = next;
      return Promise.resolve();
    },
  };
  return { storage, saved: () => ({ current, backup }) };
}

function setup(storage: SnapshotStorage) {
  const store = createEditorStore();
  const reportError = vi.fn();
  const persistence = startPersistence({
    store,
    storage,
    readFileText: (text) => Promise.resolve(readFileText(text)),
    reportError,
    delayMs: 500,
  });
  return { store, reportError, persistence };
}

const settle = () => vi.advanceTimersByTimeAsync(0);
const draw = (store: ReturnType<typeof createEditorStore>, id: string) => {
  executeCommand(store, createShapeCommand(makeRect({ id: testShapeId(id) })));
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('autosave', () => {
  it('restores the last snapshot, then turns autosave on', async () => {
    const { store } = setup(memoryStorage({ current: snapshot(4) }).storage);
    expect(store.getState().autosave).toBe('starting');
    await settle();
    expect(store.getState().document.order).toEqual(['saved']);
    expect(store.getState().autosave).toBe('on');
  });

  it('falls back to the backup when the current snapshot is unreadable', async () => {
    const storage = memoryStorage({ current: snapshot(5, '{oops'), backup: snapshot(4) });
    const { store, reportError } = setup(storage.storage);
    await settle();
    expect(store.getState().document.order).toEqual(['saved']);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('starts empty and says so when no snapshot is readable', async () => {
    const { store, reportError } = setup(memoryStorage({ current: snapshot(1, '{oops') }).storage);
    await settle();
    expect(store.getState().document.order).toEqual([]);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/couldn't be opened/) as unknown }),
    );
  });

  it('saves once after a quiet period, numbering on from the stored counter', async () => {
    const memory = memoryStorage({ current: snapshot(7) });
    const { store } = setup(memory.storage);
    await settle();
    draw(store, 'a');
    await vi.advanceTimersByTimeAsync(300);
    draw(store, 'b');
    await vi.advanceTimersByTimeAsync(499);
    expect(memory.saved().current?.counter).toBe(7);
    await vi.advanceTimersByTimeAsync(1);
    const { current, backup } = memory.saved();
    expect(current?.counter).toBe(8);
    expect(backup?.counter).toBe(7);
    const read = readFileText(current?.file ?? '');
    expect(read.ok && read.value.map((shape) => shape.id)).toEqual(['saved', 'a', 'b']);
  });

  it('flush saves a pending change at once', async () => {
    const memory = memoryStorage();
    const { store, persistence } = setup(memory.storage);
    await settle();
    draw(store, 'a');
    await persistence.flush();
    expect(memory.saved().current?.counter).toBe(1);
  });

  it('keeps what was drawn while the snapshot was loading', async () => {
    const { store } = setup(memoryStorage({ current: snapshot(1) }).storage);
    draw(store, 'early');
    await settle();
    expect(store.getState().document.order).toEqual(['early']);
  });

  it.each([
    [
      'loading',
      { load: () => Promise.reject(new Error('blocked')), save: () => Promise.resolve() },
    ],
    ['saving', { ...memoryStorage().storage, save: () => Promise.reject(new Error('quota')) }],
  ])('turns autosave off when %s fails, and keeps working', async (_name, storage) => {
    const { store, reportError } = setup(storage);
    await settle();
    draw(store, 'a');
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().autosave).toBe('unavailable');
    expect(store.getState().document.order).toEqual(['a']);
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});
