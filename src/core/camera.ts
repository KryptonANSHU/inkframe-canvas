import { createPoint, type Point } from './geometry/point';

// The only place that converts between coordinate spaces:
//   world  – where shapes live
//   screen – CSS pixels relative to the canvas's top-left corner
//   device – backing-store pixels (screen × devicePixelRatio)
//
// (x, y) is the world point shown at the screen origin, so
//   screen = (world − camera) × zoom
//   world  = screen / zoom + camera

export type Camera = { readonly x: number; readonly y: number; readonly zoom: number };

/** A 2D affine transform in the argument order of CanvasRenderingContext2D.setTransform. */
export type Transform = { a: number; b: number; c: number; d: number; e: number; f: number };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export const DEFAULT_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

export function worldToScreen(
  camera: Camera,
  world: Readonly<Point>,
  out: Point = createPoint(),
): Point {
  out.x = (world.x - camera.x) * camera.zoom;
  out.y = (world.y - camera.y) * camera.zoom;
  return out;
}

export function screenToWorld(
  camera: Camera,
  screen: Readonly<Point>,
  out: Point = createPoint(),
): Point {
  out.x = screen.x / camera.zoom + camera.x;
  out.y = screen.y / camera.zoom + camera.y;
  return out;
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Multiplies the zoom by `factor` while keeping the world point under `anchor`
 * (a screen point, usually the cursor) fixed on screen.
 */
export function zoomAt(camera: Camera, anchor: Readonly<Point>, factor: number): Camera {
  if (!Number.isFinite(factor) || factor <= 0) {
    return camera;
  }
  const zoom = clampZoom(camera.zoom * factor);
  if (zoom === camera.zoom) {
    return camera;
  }
  const anchorWorldX = anchor.x / camera.zoom + camera.x;
  const anchorWorldY = anchor.y / camera.zoom + camera.y;
  return { x: anchorWorldX - anchor.x / zoom, y: anchorWorldY - anchor.y / zoom, zoom };
}

/** Moves the content by (dx, dy) screen pixels, like dragging the page under a hand tool. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { x: camera.x - dx / camera.zoom, y: camera.y - dy / camera.zoom, zoom: camera.zoom };
}

/** The world → device transform the renderer sets once per frame. */
export function worldToDeviceTransform(
  camera: Camera,
  devicePixelRatio: number,
  out: Transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
): Transform {
  const scale = camera.zoom * devicePixelRatio;
  out.a = scale;
  out.b = 0;
  out.c = 0;
  out.d = scale;
  out.e = -camera.x * scale;
  out.f = -camera.y * scale;
  return out;
}
