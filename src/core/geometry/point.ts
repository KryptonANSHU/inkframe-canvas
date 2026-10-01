// Mutable on purpose: hot paths (pointermove, draw) pass a reusable `out` point
// instead of allocating a new one. Inputs are typed as Readonly<Point>.
export type Point = { x: number; y: number };

export function createPoint(x = 0, y = 0): Point {
  return { x, y };
}
