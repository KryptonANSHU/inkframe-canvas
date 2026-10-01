import { readFileText } from '../core/persistence/readFile';
import type { FileWorkerRequest, FileWorkerResponse } from './fileProtocol';

/**
 * Parses and validates Inkframe files off the main thread, so opening a 20 MB file
 * never freezes the canvas. zod only ever loads here.
 */
const post = (message: FileWorkerResponse) => {
  self.postMessage(message);
};

self.onmessage = ({ data }: MessageEvent<FileWorkerRequest>) => {
  const { id, text } = data;
  const result = readFileText(text, (checked, total) => {
    post({ id, type: 'progress', checked, total });
  });
  post(
    result.ok
      ? { id, type: 'read', shapes: result.value }
      : { id, type: 'failed', message: result.error.message },
  );
};
