import type { Result } from '../result';
import type { Shape } from '../shapes';
import { FILE_FORMAT, FileError, fileTooLarge, MAX_FILE_BYTES, MAX_SHAPES } from './fileFormat';
import { CURRENT_VERSION, migrate, MIGRATIONS, type Migration, type RawFile } from './migrations';
import { describeIssue, importedShapeSchema } from './schema';

// Reading and validating files. Imports zod, so only the file worker (and tests) load
// this module; the main thread only writes files and talks to the worker.

export type ReadProgress = (checked: number, total: number) => void;

/** How often (in shapes) validation reports progress. */
const PROGRESS_STEP = 500;

/** JSON text → validated shapes. Meant for a worker: large files take a while. */
export function readFileText(
  text: string,
  onProgress: ReadProgress = () => undefined,
): Result<Shape[], FileError> {
  // A UTF-16 length over the byte limit means the UTF-8 file was over it too.
  if (text.length > MAX_FILE_BYTES) {
    return fail(fileTooLarge());
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(NOT_INKFRAME);
  }
  return readFile(raw, onProgress);
}

/**
 * A parsed file → validated shapes: checks it is an Inkframe file of a version this
 * build understands, migrates it, then validates every shape. All or nothing.
 */
export function readFile(
  raw: unknown,
  onProgress: ReadProgress = () => undefined,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): Result<Shape[], FileError> {
  if (!isRecord(raw) || raw['format'] !== FILE_FORMAT) {
    return fail(NOT_INKFRAME);
  }
  const version = raw['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail(NOT_INKFRAME);
  }
  if (version > CURRENT_VERSION) {
    return fail(
      `This file was saved by a newer version of Inkframe (format ${String(version)}). Reload the page to update, then open it again.`,
    );
  }
  const migrated = migrate(raw, version, CURRENT_VERSION, migrations);
  if (!migrated.ok) {
    return fail(
      `This file's format (version ${String(version)}) can't be upgraded. ${migrated.error}`,
    );
  }
  return readShapes(migrated.value['shapes'], onProgress);
}

function readShapes(raw: unknown, onProgress: ReadProgress): Result<Shape[], FileError> {
  if (!Array.isArray(raw)) {
    return fail(NOT_INKFRAME);
  }
  if (raw.length > MAX_SHAPES) {
    return fail(
      `This file has ${raw.length.toLocaleString('en')} shapes; Inkframe opens up to ${MAX_SHAPES.toLocaleString('en')}. Split it into smaller files and try again.`,
    );
  }
  const shapes: Shape[] = [];
  const ids = new Set<string>();
  for (const [i, item] of raw.entries()) {
    const parsed = importedShapeSchema.safeParse(item);
    if (!parsed.success) {
      return fail(
        `Shape ${String(i + 1)} in this file is invalid (${describeIssue(parsed.error)}). Export the file again and retry.`,
      );
    }
    if (ids.has(parsed.data.id)) {
      return fail(
        `Two shapes in this file share the ID "${parsed.data.id}". Export the file again and retry.`,
      );
    }
    ids.add(parsed.data.id);
    shapes.push(parsed.data);
    if ((i + 1) % PROGRESS_STEP === 0) {
      onProgress(i + 1, raw.length);
    }
  }
  onProgress(raw.length, raw.length);
  return { ok: true, value: shapes };
}

const NOT_INKFRAME = "This isn't an Inkframe file. Choose a .json file saved from Inkframe.";

function fail(message: string): { ok: false; error: FileError } {
  return { ok: false, error: new FileError(message) };
}

function isRecord(value: unknown): value is RawFile {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
