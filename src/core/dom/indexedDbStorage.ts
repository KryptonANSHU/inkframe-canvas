import type { Snapshot, SnapshotStorage } from '../persistence/autosave';

const DATABASE = 'inkframe';
const STORE = 'snapshots';
const CURRENT = 'current';
const BACKUP = 'backup';

/**
 * Autosave snapshots in IndexedDB: the newest under "current", the one before under
 * "backup". Opening fails in browsers that block storage (some private modes); the
 * caller then turns autosave off.
 */
export function createIndexedDbStorage(): SnapshotStorage {
  let database: Promise<IDBDatabase> | null = null;
  const open = () => (database ??= openDatabase());

  return {
    async load() {
      const db = await open();
      const transaction = db.transaction(STORE, 'readonly');
      const store = transaction.objectStore(STORE);
      const [current, backup] = await Promise.all([
        request<unknown>(store.get(CURRENT)),
        request<unknown>(store.get(BACKUP)),
      ]);
      return { current: asSnapshot(current), backup: asSnapshot(backup) };
    },

    async save(snapshot) {
      const db = await open();
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE);
      // Writes are issued from the read's callback, while the transaction is surely active.
      const reading = store.get(CURRENT) as IDBRequest<unknown>;
      reading.onsuccess = () => {
        if (reading.result !== undefined) {
          store.put(reading.result, BACKUP);
        }
        store.put(snapshot, CURRENT);
      };
      await done(transaction);
    },
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1);
    opening.onupgradeneeded = () => {
      opening.result.createObjectStore(STORE);
    };
    opening.onsuccess = () => {
      resolve(opening.result);
    };
    opening.onerror = () => {
      reject(opening.error ?? new Error('IndexedDB failed to open.'));
    };
    opening.onblocked = () => {
      reject(new Error('IndexedDB is blocked by another tab.'));
    };
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      resolve(req.result);
    };
    req.onerror = () => {
      reject(req.error ?? new Error('IndexedDB request failed.'));
    };
  });
}

/** Resolves once every write in the transaction is committed; rejects if it aborts. */
function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    };
  });
}

/** Stored values are our own, but check the shape before trusting them. */
function asSnapshot(value: unknown): Snapshot | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { counter, savedAt, file } = value as Record<string, unknown>;
  return typeof counter === 'number' && typeof savedAt === 'number' && typeof file === 'string'
    ? { counter, savedAt, file }
    : null;
}
