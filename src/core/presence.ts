import { worldToScreen } from './camera';
import type { Peer } from './collabState';
import { inflateBox } from './geometry/bounds';
import type { Point } from './geometry/point';
import { rotatedBoxCorners } from './geometry/transform';
import type { RenderContext } from './renderer';
import { shapeBox } from './shapeGeometry';
import type { EditorState } from './store';
import { colors, fontFamily, fontSize, space } from '../design/tokens';

/** Screen pixels: how far a name label sits from the cursor tip, its padding and corners. */
const LABEL_OFFSET = { x: 12, y: 18 };
const LABEL_PADDING = { x: space[2], y: space[1] };
const LABEL_RADIUS = 4;
const SELECTION_GAP_PX = 4;
/** The cursor arrow, as a path in screen pixels from its tip. */
const ARROW: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, 15],
  [4, 11.5],
  [7, 18],
  [9.5, 17],
  [6.5, 10.5],
  [12, 10.5],
];
/** White in both themes: peer colors are chosen dark enough to carry it. */
const LABEL_TEXT = colors.light.surface;

/**
 * Collaborators on the canvas: their selections outlined in their color, then their
 * cursors with name labels, over everything else. Drawn in device pixels, the same
 * size at every zoom. Nothing is drawn when alone.
 */
export function drawPresence(context: RenderContext, state: EditorState, dpr: number): void {
  const peers = state.collab?.peers;
  if (peers === undefined || peers.length === 0) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  for (const peer of peers) drawSelection(context, state, peer, dpr);
  for (const peer of peers) {
    if (peer.cursor !== null) {
      const at = worldToScreen(state.camera, peer.cursor);
      drawCursor(context, peer, at.x * dpr, at.y * dpr, dpr);
    }
  }
}

function drawSelection(context: RenderContext, state: EditorState, peer: Peer, dpr: number) {
  context.strokeStyle = peer.color;
  context.lineWidth = Math.max(1, Math.round(1.5 * dpr));
  context.lineJoin = 'miter';
  for (const id of peer.selection) {
    const shape = state.preview?.get(id) ?? state.document.shapes.get(id);
    if (shape === undefined) continue;
    // A few pixels outside the shape, so it reads as a selection, not a recolored stroke.
    const box = inflateBox(shapeBox(shape), SELECTION_GAP_PX / state.camera.zoom);
    const corners = rotatedBoxCorners(box, shape.rotation).map((corner) => {
      const screen = worldToScreen(state.camera, corner);
      return { x: screen.x * dpr, y: screen.y * dpr };
    });
    tracePolygon(context, corners);
    context.stroke();
  }
}

function drawCursor(context: RenderContext, peer: Peer, x: number, y: number, dpr: number) {
  context.beginPath();
  ARROW.forEach(([dx, dy], i) => {
    if (i === 0) context.moveTo(x + dx * dpr, y + dy * dpr);
    else context.lineTo(x + dx * dpr, y + dy * dpr);
  });
  context.closePath();
  context.fillStyle = peer.color;
  context.fill();
  context.strokeStyle = LABEL_TEXT;
  context.lineWidth = Math.max(1, Math.round(dpr));
  context.stroke();

  context.font = `${String(fontSize.xs * dpr)}px ${fontFamily.ui}`;
  context.textBaseline = 'middle';
  const width = context.measureText(peer.name).width + 2 * LABEL_PADDING.x * dpr;
  const height = (fontSize.xs + 2 * LABEL_PADDING.y) * dpr;
  const left = x + LABEL_OFFSET.x * dpr;
  const top = y + LABEL_OFFSET.y * dpr;
  context.beginPath();
  context.roundRect(left, top, width, height, LABEL_RADIUS * dpr);
  context.fillStyle = peer.color;
  context.fill();
  context.fillStyle = LABEL_TEXT;
  context.fillText(peer.name, left + LABEL_PADDING.x * dpr, top + height / 2);
}

function tracePolygon(context: RenderContext, points: readonly Readonly<Point>[]) {
  context.beginPath();
  points.forEach((point, i) => {
    if (i === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
}
