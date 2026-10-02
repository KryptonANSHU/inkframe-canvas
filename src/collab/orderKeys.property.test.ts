import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { assignKeys, keyBetween } from './orderKeys';

const key = fc.stringMatching(/^[0-9A-Za-z]{0,6}[1-9A-Za-z]$/);

describe('order keys (property)', () => {
  it('a key between two keys sorts strictly between them', () => {
    fc.assert(
      fc.property(key, key, (x, y) => {
        fc.pre(x !== y);
        const [low, high] = x < y ? [x, y] : [y, x];
        const middle = keyBetween(low, high);
        expect(low < middle && middle < high).toBe(true);
        expect(middle.endsWith('0')).toBe(false);
      }),
    );
  });

  it('assigned keys always sort in the requested order', () => {
    const ids = fc.uniqueArray(fc.integer({ min: 0, max: 40 }), { maxLength: 30 });
    fc.assert(
      fc.property(
        ids,
        fc.array(fc.option(key, { nil: undefined }), { maxLength: 30 }),
        (order, keys) => {
          const names = order.map(String);
          const current = new Map<string, string>();
          names.forEach((id, i) => {
            const k = keys[i];
            if (k !== undefined) current.set(id, k);
          });
          const merged = new Map([...current, ...assignKeys(names, current)]);
          const sequence = names.map((id) => merged.get(id) ?? '');
          expect(sequence.every((k, i) => i === 0 || (sequence[i - 1] ?? '') < k)).toBe(true);
        },
      ),
    );
  });
});
