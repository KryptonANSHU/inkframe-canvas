import type { Bounds } from '../core/geometry/bounds';
import type { Shape, TextFont } from '../core/shapes';

export type ExportFormat = 'png' | 'svg';

/** Messages between the editor and the export worker. Both sides are this app's code. */
export type ExportRequest = {
  readonly id: number;
  readonly format: ExportFormat;
  /** Bottom to top. */
  readonly shapes: readonly Shape[];
  readonly area: Bounds;
  /** Absolute URL of each text face, loaded (PNG) or embedded (SVG) when used. */
  readonly fontUrls: Readonly<Record<TextFont, string>>;
};

export type ExportResponse =
  | { readonly id: number; readonly type: 'done'; readonly blob: Blob }
  | { readonly id: number; readonly type: 'failed'; readonly message: string };
