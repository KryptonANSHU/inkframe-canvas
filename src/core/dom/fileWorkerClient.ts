import { FileError } from '../persistence/fileFormat';
import type { Result } from '../result';
import type { Shape } from '../shapes';
import type { FileWorkerRequest, FileWorkerResponse } from '../../workers/fileProtocol';

type Pending = {
  readonly resolve: (result: Result<Shape[], FileError>) => void;
  readonly onProgress: (fraction: number) => void;
};

export type FileReaderClient = {
  /** Validated shapes from file text, read in a worker. Progress is 0–1. */
  read(text: string, onProgress?: (fraction: number) => void): Promise<Result<Shape[], FileError>>;
  dispose(): void;
};

/** Starts the file worker on first use and keeps it for later reads. */
export function createFileReaderClient(): FileReaderClient {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  const failAll = (message: string) => {
    for (const { resolve } of pending.values()) {
      resolve({ ok: false, error: new FileError(message) });
    }
    pending.clear();
  };
  const start = () => {
    const started = new Worker(new URL('../../workers/fileWorker.ts', import.meta.url), {
      type: 'module',
    });
    started.onmessage = ({ data }: MessageEvent<FileWorkerResponse>) => {
      const request = pending.get(data.id);
      if (request === undefined) {
        return;
      }
      if (data.type === 'progress') {
        request.onProgress(data.total === 0 ? 1 : data.checked / data.total);
        return;
      }
      pending.delete(data.id);
      request.resolve(
        data.type === 'read'
          ? { ok: true, value: data.shapes }
          : { ok: false, error: new FileError(data.message) },
      );
    };
    started.onerror = () => {
      failAll("Inkframe couldn't start reading the file. Reload the page and try again.");
      worker?.terminate();
      worker = null;
    };
    return started;
  };

  return {
    read(text, onProgress = () => undefined) {
      worker ??= start();
      const id = nextId++;
      const request: FileWorkerRequest = { id, type: 'read', text };
      return new Promise((resolve) => {
        pending.set(id, { resolve, onProgress });
        worker?.postMessage(request);
      });
    },
    dispose() {
      worker?.terminate();
      worker = null;
      failAll('The editor was closed.');
    },
  };
}
