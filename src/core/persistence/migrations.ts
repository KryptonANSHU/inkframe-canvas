import type { Result } from '../result';

/** The file format version this build writes. */
export const CURRENT_VERSION = 1;

/** A file's top-level object, before it has been validated. */
export type RawFile = Readonly<Record<string, unknown>>;

/** Upgrades a file by exactly one version. Pure: returns a new object. */
export type Migration = (file: RawFile) => RawFile;

/**
 * `MIGRATIONS[n]` turns a version-n file into version n + 1 (e.g. `1: migrateV1toV2`).
 * Empty while version 1 is the only format; each new version adds one entry here,
 * with its own tests.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

/**
 * Runs a file through every migration from `from` up to `to`, in order. Fails if a
 * step is missing, so a file is never half-upgraded.
 */
export function migrate(
  file: RawFile,
  from: number,
  to: number = CURRENT_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): Result<RawFile, string> {
  let current = file;
  for (let version = from; version < to; version++) {
    const step = migrations[version];
    if (step === undefined) {
      return { ok: false, error: `No migration from version ${String(version)}.` };
    }
    current = { ...step(current), version: version + 1 };
  }
  return { ok: true, value: current };
}
