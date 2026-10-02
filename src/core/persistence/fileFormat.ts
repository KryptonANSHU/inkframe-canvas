import { settleAttachments } from '../attachments';
import { EMPTY_DOCUMENT, insertShape, type DocumentState } from '../document';
import type { Shape } from '../shapes';
import { CURRENT_VERSION } from './migrations';

export const FILE_FORMAT = 'inkframe';
/** Import limits. Paths over the point limit are simplified, not refused. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_SHAPES = 20_000;

/** What Inkframe writes: shapes listed bottom to top. */
export type InkframeFile = {
  readonly format: typeof FILE_FORMAT;
  readonly version: typeof CURRENT_VERSION;
  readonly shapes: readonly Shape[];
};

/** A file Inkframe can't open. The message says why and what to do, for the user. */
export class FileError extends Error {
  override readonly name = 'FileError';
}

export function toFile(document: DocumentState): InkframeFile {
  const shapes = document.order.flatMap((id) => {
    const shape = document.shapes.get(id);
    return shape === undefined ? [] : [shape];
  });
  return { format: FILE_FORMAT, version: CURRENT_VERSION, shapes };
}

/**
 * Builds a document from shapes listed bottom to top; their zIndex is renumbered, and
 * arrows are settled on the shapes they are attached to (dropping attachments to
 * shapes that aren't there).
 */
export function documentFromShapes(shapes: readonly Shape[]): DocumentState {
  return settleAttachments(shapes).reduce<DocumentState>(
    (document, shape) => insertShape(document, { ...shape, zIndex: document.order.length }),
    EMPTY_DOCUMENT,
  );
}

/** The message for a file over MAX_FILE_BYTES; checked before reading when possible. */
export function fileTooLarge(): string {
  return `This file is over the ${String(MAX_FILE_BYTES / 1024 / 1024)} MB limit. Split it into smaller files and try again.`;
}
