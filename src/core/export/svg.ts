import { assertNever } from '../assertNever';
import type { Bounds } from '../geometry/bounds';
import { createPoint } from '../geometry/point';
import { ARROW_HEAD_SIDES, arrowHeadWing, isFilled, shapeBox } from '../shapeGeometry';
import type { PathPoint, Shape, TextShape } from '../shapes';
import { TEXT_FONT_FAMILY } from '../text/font';
import type { TextLayout } from '../text/layout';

/**
 * An SVG document drawing `shapes` exactly as the canvas renderer does: each shape
 * centered on its box and rotated around it, the same paths, caps, and joins, and text
 * broken into the same lines. `fontCss` (an @font-face rule embedding the text font)
 * makes text look the same in any viewer.
 */
export function shapesToSvg(
  shapes: readonly Shape[],
  area: Bounds,
  layoutText: (shape: TextShape) => TextLayout,
  fontCss: string | null,
): string {
  const width = area.maxX - area.minX;
  const height = area.maxY - area.minY;
  const style =
    fontCss !== null && shapes.some((shape) => shape.type === 'text')
      ? `<style>${fontCss}</style>`
      : '';
  const body = shapes.map((shape) => shapeToSvg(shape, layoutText)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" ` +
    `viewBox="${n(area.minX)} ${n(area.minY)} ${n(width)} ${n(height)}">${style}${body}</svg>`
  );
}

function shapeToSvg(shape: Shape, layoutText: (shape: TextShape) => TextLayout): string {
  const box = shapeBox(shape);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const rotation = (shape.rotation * 180) / Math.PI;
  const content =
    shape.type === 'text' ? textToSvg(shape, layoutText(shape)) : outlinedToSvg(shape, box);
  return (
    `<g transform="translate(${n(centerX)} ${n(centerY)}) rotate(${n(rotation)})" ` +
    `opacity="${n(shape.style.opacity)}">${content}</g>`
  );
}

function outlinedToSvg(
  shape: Exclude<Shape, TextShape>,
  box: { width: number; height: number; x: number; y: number },
): string {
  const { style } = shape;
  const fill = isFilled(shape) && style.fillColor !== null ? style.fillColor : 'none';
  const join = shape.type === 'rectangle' ? 'miter' : 'round';
  const paint =
    `fill="${fill}" stroke="${style.strokeColor}" stroke-width="${n(style.strokeWidth)}" ` +
    `stroke-linecap="round" stroke-linejoin="${join}"`;
  // Path points are relative to (x, y); this offset makes them relative to the center.
  const offsetX = shape.x - (box.x + box.width / 2);
  const offsetY = shape.y - (box.y + box.height / 2);
  switch (shape.type) {
    case 'rectangle':
      return `<rect x="${n(-box.width / 2)}" y="${n(-box.height / 2)}" width="${n(box.width)}" height="${n(box.height)}" ${paint}/>`;
    case 'ellipse':
      return `<ellipse rx="${n(box.width / 2)}" ry="${n(box.height / 2)}" ${paint}/>`;
    case 'line':
      return `<path d="${polyline(shape.points, offsetX, offsetY)}" ${paint}/>`;
    case 'arrow': {
      const tip = shape.points[1];
      const wing = createPoint();
      const head = ARROW_HEAD_SIDES.map((side) => {
        arrowHeadWing(shape, side, wing);
        return `M${n(tip.x + offsetX)} ${n(tip.y + offsetY)}L${n(wing.x + offsetX)} ${n(wing.y + offsetY)}`;
      }).join('');
      return `<path d="${polyline(shape.points, offsetX, offsetY)}${head}" ${paint}/>`;
    }
    case 'pen':
      return `<path d="${smoothPath(shape.points, offsetX, offsetY)}" ${paint}/>`;
    default:
      return assertNever(shape);
  }
}

/** Each line on its baseline, from the top-left of the box, as the renderer draws them. */
function textToSvg(shape: TextShape, layout: TextLayout): string {
  const left = -shape.width / 2;
  const top = -shape.height / 2 + layout.ascent;
  const lines = layout.lines
    .map(
      (line, i) =>
        `<tspan x="${n(left)}" y="${n(top + i * layout.lineHeight)}">${escapeXml(line.text)}</tspan>`,
    )
    .join('');
  // Spaces are kept as typed, like the canvas; SVG would collapse them otherwise.
  return (
    `<text xml:space="preserve" style="white-space:pre" font-family="${TEXT_FONT_FAMILY}, sans-serif" ` +
    `font-size="${n(shape.fontSize)}" fill="${shape.style.strokeColor}">${lines}</text>`
  );
}

function polyline(points: readonly PathPoint[], dx: number, dy: number): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${n(p.x + dx)} ${n(p.y + dy)}`).join('');
}

/** Curves through the midpoints between points, matching the renderer's pen strokes. */
function smoothPath(points: readonly PathPoint[], dx: number, dy: number): string {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) {
    return '';
  }
  let d = `M${n(first.x + dx)} ${n(first.y + dy)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const next = points[i + 1];
    if (point !== undefined && next !== undefined) {
      d += `Q${n(point.x + dx)} ${n(point.y + dy)} ${n((point.x + next.x) / 2 + dx)} ${n((point.y + next.y) / 2 + dy)}`;
    }
  }
  return `${d}L${n(last.x + dx)} ${n(last.y + dy)}`;
}

/** Numbers to at most 3 decimals: well under a pixel, and much smaller files. */
function n(value: number): string {
  return String(Math.round(value * 1000) / 1000 + 0);
}

/** Text is user content: escaped, and stripped of characters XML forbids. */
function escapeXml(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex -- matching them is the point: XML 1.0 forbids them
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  );
}
