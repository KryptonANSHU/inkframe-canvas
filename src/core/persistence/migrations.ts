import type { Result } from '../result';

/**
 * The file format version this build writes. Version 2 added groups, version 3 arrows
 * attached to shapes, version 4 a font per text shape.
 */
export const CURRENT_VERSION = 4;

/** A file's top-level object, before it has been validated. */
export type RawFile = Readonly<Record<string, unknown>>;

/** Upgrades a file by exactly one version. Pure: returns a new object. */
export type Migration = (file: RawFile) => RawFile;

/**
 * Version 1 had no groups, so its shapes are already valid version-2 shapes. The
 * version bump is what matters: an older Inkframe refuses a file with groups (as a
 * newer version) instead of silently dropping them.
 */
export const migrateV1toV2: Migration = (file) => ({ ...file });

/** Version 2 had no attachments: same story, its arrows are valid version-3 arrows. */
export const migrateV2toV3: Migration = (file) => ({ ...file });

/** Version 3 text had no font: absent means Normal, exactly how it looked. */
export const migrateV3toV4: Migration = (file) => ({ ...file });

/** `MIGRATIONS[n]` turns a version-n file into version n + 1, each with its own tests. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: migrateV1toV2,
  2: migrateV2toV3,
  3: migrateV3toV4,
};

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
