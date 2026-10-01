/** An unrotated rectangle: top-left corner plus size. */
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** An axis-aligned bounding box, edges inclusive. */
export type Bounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export function inflateBox(box: Box, margin: number): Box {
  return {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2,
  };
}

/** The axis-aligned bounds of `box` rotated by `rotation` radians around its center. */
export function rotatedBoxBounds(box: Box, rotation: number): Bounds {
  const cos = Math.abs(Math.cos(rotation));
  const sin = Math.abs(Math.sin(rotation));
  const halfWidth = (box.width * cos + box.height * sin) / 2;
  const halfHeight = (box.width * sin + box.height * cos) / 2;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  return {
    minX: centerX - halfWidth,
    minY: centerY - halfHeight,
    maxX: centerX + halfWidth,
    maxY: centerY + halfHeight,
  };
}

export function boundsAround(x: number, y: number, radius: number): Bounds {
  return { minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius };
}

export function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

export function isFiniteBounds(bounds: Bounds): boolean {
  return (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.maxY)
  );
}

/** The smallest bounds holding both. */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}
