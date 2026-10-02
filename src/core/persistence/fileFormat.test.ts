import { describe, expect, it } from 'vitest';
import { MAX_PEN_POINTS } from '../shapes';
import { makePen, makeRect, makeText, testShapeId } from '../testing/factories';
import { documentFromShapes, MAX_FILE_BYTES, MAX_SHAPES, toFile } from './fileFormat';
import { readFile, readFileText } from './readFile';
import {
  CURRENT_VERSION,
  migrate,
  migrateV1toV2,
  migrateV2toV3,
  migrateV3toV4,
  type RawFile,
} from './migrations';

const rect = makeRect({ id: testShapeId('r') });
const text = makeText({ id: testShapeId('t') });
const file = (shapes: unknown[], extra: object = {}) => ({
  format: 'inkframe',
  version: 1,
  shapes,
  ...extra,
});

function errorOf(raw: unknown): string {
  const result = readFile(raw);
  return result.ok ? 'no error' : result.error.message;
}

describe('file format', () => {
  it('writes shapes bottom to top and reads them back exactly', () => {
    const document = documentFromShapes([rect, text]);
    const read = readFileText(JSON.stringify(toFile(document)));
    expect(read.ok && documentFromShapes(read.value)).toEqual(document);
  });

  it('renumbers zIndex from the order in the file', () => {
    const document = documentFromShapes([
      { ...text, zIndex: 7 },
      { ...rect, zIndex: 0 },
    ]);
    expect(document.order).toEqual(['t', 'r']);
    expect(document.shapes.get(rect.id)?.zIndex).toBe(1);
  });

  it.each([
    ['not JSON', '{', /isn't an Inkframe file/],
    [
      'another format',
      JSON.stringify({ format: 'other', version: 1, shapes: [] }),
      /isn't an Inkframe file/,
    ],
    [
      'a newer version',
      JSON.stringify(file([], { version: CURRENT_VERSION + 1 })),
      /newer version of Inkframe/,
    ],
    ['an over-size file', ' '.repeat(MAX_FILE_BYTES + 1), /over the 20 MB limit/],
  ])('refuses %s with a message saying why', (_name, text, message) => {
    const result = readFileText(text);
    expect(result.ok ? 'no error' : result.error.message).toMatch(message);
  });

  it('refuses too many shapes, naming the limit', () => {
    const shapes = Array.from({ length: MAX_SHAPES + 1 }, () => ({}));
    expect(errorOf(file(shapes))).toMatch(/20,001 shapes; Inkframe opens up to 20,000/);
  });

  it('names the first invalid shape and what is wrong with it', () => {
    expect(errorOf(file([rect, { ...rect, id: 'x', width: 0 }]))).toMatch(/Shape 2 .*width/);
    expect(errorOf(file([{ ...rect, x: '1' }]))).toMatch(/Shape 1 .*\bx\b/);
    expect(errorOf(file([rect, rect]))).toMatch(/share the ID "r"/);
  });

  it('normalizes rotation and drops unknown fields', () => {
    const read = readFile(file([{ ...rect, rotation: -Math.PI / 2, extra: true }]));
    expect(read.ok && read.value[0]).toEqual({ ...rect, rotation: (3 * Math.PI) / 2 });
  });

  it('simplifies freehand paths over the point limit instead of refusing them', () => {
    const points = Array.from({ length: MAX_PEN_POINTS * 3 }, (_, i) => ({ x: i, y: i % 2 }));
    const read = readFile(file([makePen({ points })]));
    const pen = read.ok ? read.value[0] : undefined;
    expect(pen?.type === 'pen' && pen.points.length).toBeLessThanOrEqual(MAX_PEN_POINTS);
  });

  it('reports progress up to the total', () => {
    const calls: number[] = [];
    readFile(file([rect]), (checked) => calls.push(checked));
    expect(calls.at(-1)).toBe(1);
  });
});

describe('migrateV1toV2', () => {
  it('keeps version-1 shapes as they are, and they read as version 2', () => {
    const v1 = file([rect]);
    expect(migrateV1toV2(v1)).toEqual(v1);
    const read = readFile(v1);
    expect(read.ok && read.value).toEqual([rect]);
  });
});

describe('migrateV2toV3', () => {
  it('keeps version-2 shapes (groups included) as they are', () => {
    const v2 = file([{ ...rect, groupId: 'g' }], { version: 2 });
    expect(migrateV2toV3(v2)).toEqual(v2);
    expect(readFile(v2).ok).toBe(true);
  });
});

describe('migrateV3toV4', () => {
  it('opens version-3 text as Normal, exactly as it looked', () => {
    const v3 = file([text], { version: 3 });
    expect(migrateV3toV4(v3)).toEqual(v3);
    const read = readFile(v3);
    expect(read.ok && read.value[0]).not.toHaveProperty('font');
  });

  it('keeps a chosen font through a save and reload', () => {
    const hand = { ...text, font: 'hand' as const };
    const read = readFile(toFile(documentFromShapes([hand])));
    expect(read.ok && read.value[0]).toMatchObject({ font: 'hand' });
  });
});

describe('migrate', () => {
  const steps = {
    1: (raw: RawFile) => ({ ...raw, renamed: raw['old'] }),
    2: (raw: RawFile) => ({ ...raw, added: true }),
  };

  it('runs every step in order and stamps each version', () => {
    expect(migrate({ version: 1, old: 'a' }, 1, 3, steps)).toEqual({
      ok: true,
      value: { version: 3, old: 'a', renamed: 'a', added: true },
    });
  });

  it('fails without half-upgrading when a step is missing', () => {
    expect(migrate({ version: 1 }, 1, 4, steps)).toEqual({
      ok: false,
      error: 'No migration from version 3.',
    });
  });
});
