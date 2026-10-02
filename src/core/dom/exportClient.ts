import type { Bounds } from '../geometry/bounds';
import type { Result } from '../result';
import type { Shape } from '../shapes';
import type { ExportFormat, ExportRequest, ExportResponse } from '../../workers/exportProtocol';
import { FONT_URLS } from './fonts';

export type ExportClient = {
  render(
    format: ExportFormat,
    shapes: readonly Shape[],
    area: Bounds,
  ): Promise<Result<Blob, Error>>;
  dispose(): void;
};

/** Starts the export worker on first use and keeps it for later exports. */
export function createExportClient(): ExportClient {
  let worker: Worker | null = null;
  let nextId = 0;
  const pending = new Map<number, (result: Result<Blob, Error>) => void>();

  const failAll = (message: string) => {
    for (const resolve of pending.values()) {
      resolve({ ok: false, error: new Error(message) });
    }
    pending.clear();
  };
  const start = () => {
    const started = new Worker(new URL('../../workers/exportWorker.ts', import.meta.url), {
      type: 'module',
    });
    started.onmessage = ({ data }: MessageEvent<ExportResponse>) => {
      const resolve = pending.get(data.id);
      pending.delete(data.id);
      resolve?.(
        data.type === 'done'
          ? { ok: true, value: data.blob }
          : { ok: false, error: new Error(data.message) },
      );
    };
    started.onerror = () => {
      failAll("Inkframe couldn't start exporting. Reload the page and try again.");
      worker?.terminate();
      worker = null;
    };
    return started;
  };

  return {
    render(format, shapes, area) {
      worker ??= start();
      const request: ExportRequest = {
        id: nextId++,
        format,
        shapes,
        area,
        fontUrls: {
          hand: new URL(FONT_URLS.hand, location.href).href,
          sans: new URL(FONT_URLS.sans, location.href).href,
          mono: new URL(FONT_URLS.mono, location.href).href,
        },
      };
      return new Promise((resolve) => {
        pending.set(request.id, resolve);
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
