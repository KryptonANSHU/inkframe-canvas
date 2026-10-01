import type { PathPoint, Shape, ShapeId } from '../src/core/shapes';
import { fillSwatches, strokeSwatches } from '../src/design/tokens';

/** The world area a benchmark drawing covers; zoomed to fit, every shape is on screen. */
export const SCENE_WIDTH = 6000;
export const SCENE_HEIGHT = 4000;

/** mulberry32: a tiny seeded PRNG, so every run draws the same document. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` shapes with a realistic mix: rectangles and ellipses (a third filled), lines,
 * arrows, pen strokes of 20–60 points, and some text. Fixed seed: the same `count`
 * always gives the same drawing.
 */
export function benchScene(count: number, seed = 1): Shape[] {
  const next = random(seed);
  const between = (min: number, max: number) => min + next() * (max - min);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  const shapes: Shape[] = [];
  for (let i = 0; i < count; i++) {
    const base = {
      id: `bench-${String(i)}` as ShapeId,
      x: between(0, SCENE_WIDTH - 200),
      y: between(0, SCENE_HEIGHT - 200),
      rotation: next() < 0.15 ? between(0, Math.PI * 2) : 0,
      style: {
        strokeColor: pick(strokeSwatches).light,
        fillColor: next() < 0.33 ? pick(fillSwatches).light : null,
        strokeWidth: pick([1, 2, 2, 4]),
        opacity: 1,
      },
      zIndex: i,
    };
    const kind = next();
    const width = between(40, 180);
    const height = between(30, 140);
    if (kind < 0.35) {
      shapes.push({ ...base, type: 'rectangle', width, height });
    } else if (kind < 0.6) {
      shapes.push({ ...base, type: 'ellipse', width, height });
    } else if (kind < 0.7) {
      shapes.push({
        ...base,
        type: 'line',
        points: [
          { x: 0, y: 0 },
          { x: width, y: height },
        ],
      });
    } else if (kind < 0.8) {
      shapes.push({
        ...base,
        type: 'arrow',
        points: [
          { x: 0, y: height },
          { x: width, y: 0 },
        ],
      });
    } else if (kind < 0.95) {
      shapes.push({ ...base, type: 'pen', points: scribble(next, width, height) });
    } else {
      shapes.push({
        ...base,
        type: 'text',
        width: 240,
        height: 25,
        text: 'Benchmark label',
        fontSize: 20,
        style: { ...base.style, fillColor: null },
      });
    }
  }
  return shapes;
}

/** A wandering freehand stroke inside a width × height box. */
function scribble(next: () => number, width: number, height: number): PathPoint[] {
  const count = 20 + Math.floor(next() * 40);
  const points: PathPoint[] = [];
  let x = next() * width;
  let y = next() * height;
  for (let i = 0; i < count; i++) {
    x = Math.min(width, Math.max(0, x + (next() - 0.5) * 24));
    y = Math.min(height, Math.max(0, y + (next() - 0.5) * 24));
    points.push({ x, y });
  }
  return points;
}
