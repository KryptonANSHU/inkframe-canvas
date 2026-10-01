import { describe, expect, it } from 'vitest';
import { assertNever } from './assertNever';

describe('assertNever', () => {
  it('throws with the unhandled value, for data that slipped past the type system', () => {
    expect(() => assertNever('triangle' as never)).toThrow('Unhandled value: "triangle"');
  });
});
