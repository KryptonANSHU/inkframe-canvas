import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { shapeArbitrary } from '../testing/arbitraries';
import { testShapeId } from '../testing/factories';
import { documentFromShapes, toFile } from './fileFormat';
import { readFileText } from './readFile';

const shapes = fc
  .array(fc.nat(), { maxLength: 30 })
  .chain((seeds) => fc.tuple(...seeds.map((_, i) => shapeArbitrary(testShapeId(`s${String(i)}`)))));

describe('file format properties', () => {
  it('any valid document survives save → JSON → open exactly', () => {
    fc.assert(
      fc.property(shapes, (list) => {
        const saved = JSON.stringify(toFile(documentFromShapes(list)));
        const read = readFileText(saved);
        // Compared as JSON, which can't tell −0 from 0; everything else must match.
        expect(read.ok && JSON.stringify(toFile(documentFromShapes(read.value)))).toBe(saved);
      }),
    );
  });
});
