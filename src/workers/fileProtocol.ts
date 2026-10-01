import type { Shape } from '../core/shapes';

/** Messages between the editor and the file worker. Both sides are this app's code. */
export type FileWorkerRequest = {
  readonly id: number;
  readonly type: 'read';
  readonly text: string;
};

export type FileWorkerResponse =
  | {
      readonly id: number;
      readonly type: 'progress';
      readonly checked: number;
      readonly total: number;
    }
  | { readonly id: number; readonly type: 'read'; readonly shapes: Shape[] }
  | { readonly id: number; readonly type: 'failed'; readonly message: string };
