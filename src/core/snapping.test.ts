import { describe, expect, it } from 'vitest';
import { snapMove } from './snapping';

const box = (minX: number, minY: number, maxX: number, maxY: number) => ({
  minX,
  minY,
  maxX,
  maxY,
});

describe('snapMove', () => {
  const target = box(200, 0, 300, 100);

  it('snaps the nearest edge or center within the threshold, per axis', () => {
    // Left edge 197 → target's left 200 (x); center y 53 → target's center 50 (y).
    expect(snapMove(box(197, 33, 237, 73), [target], 6)).toMatchObject({ dx: 3, dy: -3 });
  });

  it('leaves the box alone beyond the threshold', () => {
    expect(snapMove(box(150, 200, 180, 230), [target], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('draws one guide per aligned line, spanning every shape on it', () => {
    const other = box(400, 500, 450, 520);
    const { guides } = snapMove(
      // 40 wide, so only its left edge lines up with anything once snapped.
      box(198, 600, 238, 640),
      [target, box(200, 300, 260, 340), other],
      6,
    );
    expect(guides).toEqual([{ axis: 'x', at: 200, from: 0, to: 640 }]);
  });
});
