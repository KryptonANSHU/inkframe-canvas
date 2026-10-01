import fc from 'fast-check';
import { describe, it } from 'vitest';

// Placeholder that proves the property project runs. Delete once M5 adds real property tests.
describe('property test project', () => {
  it('runs fast-check properties', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (values) => {
        const reversedTwice = [...values].reverse().reverse();
        return reversedTwice.every((value, index) => value === values[index]);
      }),
    );
  });
});
