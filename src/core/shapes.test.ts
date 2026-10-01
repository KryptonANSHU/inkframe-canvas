import { describe, expect, it } from 'vitest';
import { createShapeId } from './shapes';

describe('createShapeId', () => {
  it('returns a different UUID every time', () => {
    const ids = new Set(Array.from({ length: 1000 }, createShapeId));
    expect(ids.size).toBe(1000);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });
});
