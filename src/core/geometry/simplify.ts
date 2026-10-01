import type { Point } from './point';

/**
 * At most `maxPoints` points that trace the same path, ends included. Visvalingam–
 * Whyatt: repeatedly drops the point whose triangle with its neighbors has the least
 * area (the one that changes the shape least) until the path fits. O(n log n), so a
 * million-point path simplifies in a fraction of a second.
 */
export function simplifyPath<T extends Readonly<Point>>(
  points: readonly T[],
  maxPoints: number,
): T[] {
  const count = points.length;
  if (count <= maxPoints || count <= 2) {
    return [...points];
  }
  // A doubly linked list over indices, so removing a point is O(1).
  const previous = Int32Array.from({ length: count }, (_, i) => i - 1);
  const next = Int32Array.from({ length: count }, (_, i) => i + 1);
  const removed = new Uint8Array(count);
  // Each point's latest queued priority; heap entries that don't match are stale.
  const priority = new Float64Array(count);
  const area = (i: number) =>
    triangleArea(points[previous[i] ?? -1], points[i], points[next[i] ?? -1]);
  const heap = new MinHeap();
  const queue = (i: number, value: number) => {
    priority[i] = value;
    heap.push(value, i);
  };
  for (let i = 1; i < count - 1; i++) {
    queue(i, area(i));
  }
  let remaining = count;
  while (remaining > maxPoints) {
    const top = heap.pop();
    if (top === undefined) {
      break;
    }
    const [smallest, i] = top;
    // Stale entry: the point is gone, or was queued again with a new priority.
    if (removed[i] === 1 || smallest !== priority[i]) {
      continue;
    }
    removed[i] = 1;
    remaining -= 1;
    const before = previous[i] ?? -1;
    const after = next[i] ?? count;
    next[before] = after;
    previous[after] = before;
    // Neighbors never drop below the removed area, so flattened spots go first.
    for (const neighbor of [before, after]) {
      if (neighbor > 0 && neighbor < count - 1) {
        queue(neighbor, Math.max(area(neighbor), smallest));
      }
    }
  }
  return points.filter((_, i) => removed[i] === 0);
}

function triangleArea(
  a: Readonly<Point> | undefined,
  b: Readonly<Point> | undefined,
  c: Readonly<Point> | undefined,
): number {
  if (a === undefined || b === undefined || c === undefined) {
    return Infinity;
  }
  return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}

/** A binary min-heap of [priority, index] pairs. */
class MinHeap {
  private readonly priorities: number[] = [];
  private readonly indices: number[] = [];

  push(priority: number, index: number): void {
    this.priorities.push(priority);
    this.indices.push(index);
    let child = this.priorities.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (this.at(parent) <= this.at(child)) {
        break;
      }
      this.swap(parent, child);
      child = parent;
    }
  }

  pop(): [number, number] | undefined {
    const top = this.priorities[0];
    const index = this.indices[0];
    if (top === undefined || index === undefined) {
      return undefined;
    }
    this.swap(0, this.priorities.length - 1);
    this.priorities.pop();
    this.indices.pop();
    let parent = 0;
    for (;;) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let smallest = parent;
      if (left < this.priorities.length && this.at(left) < this.at(smallest)) smallest = left;
      if (right < this.priorities.length && this.at(right) < this.at(smallest)) smallest = right;
      if (smallest === parent) {
        return [top, index];
      }
      this.swap(parent, smallest);
      parent = smallest;
    }
  }

  private at(i: number): number {
    return this.priorities[i] ?? Infinity;
  }

  private swap(a: number, b: number): void {
    [this.priorities[a], this.priorities[b]] = [this.at(b), this.at(a)];
    [this.indices[a], this.indices[b]] = [this.indices[b] ?? -1, this.indices[a] ?? -1];
  }
}
