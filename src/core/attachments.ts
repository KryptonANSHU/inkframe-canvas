import {
  deleteShapesCommand,
  sequenceCommand,
  updateShapesCommand,
  type Command,
} from './commands';
import type { DocumentState } from './document';
import { distance, type Point } from './geometry/point';
import { toWorldPoint } from './geometry/transform';
import { pathWorldPoints, shapeGeometryBounds } from './shapeGeometry';
import {
  ANCHORS,
  MIN_SHAPE_SIZE,
  type Anchor,
  type ArrowShape,
  type Attachment,
  type BoxShape,
  type Shape,
  type ShapeId,
} from './shapes';
import { pathBetween } from './tools/shapeBuilders';

/**
 * Connected arrows. An arrow end may be attached to an anchor of a box shape; whenever
 * that shape changes, the change brings the arrow along in the same command, so undo
 * and redo stay exact and nothing is recomputed behind the history's back.
 */

/** Anchor positions as fractions of the shape's width and height, from its center. */
const ANCHOR_OFFSETS: Readonly<Record<Anchor, readonly [number, number]>> = {
  center: [0, 0],
  top: [0, -0.5],
  right: [0.5, 0],
  bottom: [0, 0.5],
  left: [-0.5, 0],
};

/** How far (world units) an end may be from its anchor and still count as on it. */
const ON_ANCHOR = 1e-6;

const ENDS = ['start', 'end'] as const;
export type End = (typeof ENDS)[number];

/** Arrows attach to rectangles, ellipses, and text; paths have no edges to hold on to. */
export function canAttachTo(shape: Shape): shape is BoxShape {
  return shape.type === 'rectangle' || shape.type === 'ellipse' || shape.type === 'text';
}

/** An anchor's world position, turning with the shape. */
export function anchorPoint(shape: BoxShape, anchor: Anchor): Point {
  const [fx, fy] = ANCHOR_OFFSETS[anchor];
  const centerX = shape.x + shape.width / 2;
  const centerY = shape.y + shape.height / 2;
  return toWorldPoint(
    { x: fx * shape.width, y: fy * shape.height },
    centerX,
    centerY,
    shape.rotation,
    { x: 0, y: 0 },
  );
}

type Lookup = (id: ShapeId) => Shape | undefined;

/**
 * The arrow with each attached end checked against its shape: re-aimed at the anchor
 * when that shape `moved`, and let go when the shape is gone or the end was moved
 * away from it (the arrow dragged on its own).
 */
function settleArrow(arrow: ArrowShape, shapeOf: Lookup, moved: (id: ShapeId) => boolean) {
  const points = pathWorldPoints(arrow);
  const kept: Partial<Record<End, Attachment>> = {};
  let reaimed = false;
  for (const [i, end] of ENDS.entries()) {
    const attachment = arrow[end];
    const target = attachment === undefined ? undefined : shapeOf(attachment.shapeId);
    const at = points[i];
    if (attachment === undefined || target === undefined || at === undefined) continue;
    if (!canAttachTo(target)) continue;
    const anchor = anchorPoint(target, attachment.anchor);
    if (moved(attachment.shapeId)) {
      points[i] = anchor;
      reaimed = true;
    } else if (distance(at, anchor) > ON_ANCHOR) {
      continue;
    }
    kept[end] = attachment;
  }
  if (!reaimed && kept.start === arrow.start && kept.end === arrow.end) return arrow;
  const { start: _start, end: _end, ...free } = arrow;
  const [from, to] = points;
  // Both ends on one spot: the arrow is stretched to its minimum length, which pulls
  // the head off its anchor, so that end lets go.
  if (reaimed && from && to && distance(from, to) < MIN_SHAPE_SIZE) delete kept.end;
  const geometry = reaimed && from && to ? { ...pathBetween(from, to), rotation: 0 } : {};
  return { ...free, ...geometry, ...kept };
}

function attachedTo(arrow: ArrowShape, ids: ReadonlySet<ShapeId> | ReadonlyMap<ShapeId, unknown>) {
  return ENDS.some((end) => {
    const id = arrow[end]?.shapeId;
    return id !== undefined && ids.has(id);
  });
}

/**
 * `before` and `after` of a change, plus every arrow it moves: arrows attached to a
 * changed shape follow it; a changed arrow whose end left its shape lets go.
 */
export function withAttachments(
  document: DocumentState,
  before: readonly Shape[],
  after: readonly Shape[],
): { before: Shape[]; after: Shape[] } {
  const changed = new Map(after.map((shape) => [shape.id, shape]));
  const shapeOf: Lookup = (id) => changed.get(id) ?? document.shapes.get(id);
  const moved = (id: ShapeId) => changed.has(id);
  const settled = new Map<ShapeId, Shape>();
  const extraBefore: Shape[] = [];
  for (const shape of document.shapes.values()) {
    if (shape.type !== 'arrow' || !(changed.has(shape.id) || attachedTo(shape, changed))) {
      continue;
    }
    const current = shapeOf(shape.id);
    if (current?.type !== 'arrow') continue;
    const next = settleArrow(current, shapeOf, moved);
    if (next === current) continue;
    settled.set(shape.id, next);
    if (!changed.has(shape.id)) extraBefore.push(shape);
  }
  return {
    before: [...before, ...extraBefore],
    after: [
      ...after.map((shape) => settled.get(shape.id) ?? shape),
      ...extraBefore.map((shape) => settled.get(shape.id) ?? shape),
    ],
  };
}

/** An update that brings attached arrows along, as one undo step. */
export function reshapeCommand(
  document: DocumentState,
  label: string,
  before: readonly Shape[],
  after: readonly Shape[],
): Command {
  const all = withAttachments(document, before, after);
  return updateShapesCommand(label, all.before, all.after);
}

/** Deletes shapes, letting go of every arrow end attached to them, as one undo step. */
export function deleteCommand(
  document: DocumentState,
  label: string,
  shapes: readonly Shape[],
): Command {
  const deleted = new Set(shapes.map((shape) => shape.id));
  const before: ArrowShape[] = [];
  for (const shape of document.shapes.values()) {
    if (shape.type === 'arrow' && !deleted.has(shape.id) && attachedTo(shape, deleted)) {
      before.push(shape);
    }
  }
  const remove = deleteShapesCommand(label, shapes);
  if (before.length === 0) return remove;
  const after = before.map((arrow) => keepAttachments(arrow, (a) => !deleted.has(a.shapeId)));
  return sequenceCommand(label, [updateShapesCommand(label, before, after), remove]);
}

/**
 * Copies keep attachments whose shape was copied too (pointing at that shape's copy)
 * and let go of the rest. `newIds` maps each original's ID to its copy's.
 */
export function remapAttachments(
  copies: readonly Shape[],
  newIds: ReadonlyMap<ShapeId, ShapeId>,
): Shape[] {
  return copies.map((shape) => {
    if (shape.type !== 'arrow') return shape;
    return keepAttachments(
      shape,
      (a) => newIds.has(a.shapeId),
      (a) => ({
        ...a,
        shapeId: newIds.get(a.shapeId) ?? a.shapeId,
      }),
    );
  });
}

/** The arrow with only the attachments `keep` accepts, optionally changed by `map`. */
function keepAttachments<T extends ArrowShape>(
  arrow: T,
  keep: (attachment: Attachment) => boolean,
  map: (attachment: Attachment) => Attachment = (a) => a,
): T {
  const { start, end, ...free } = arrow;
  return {
    ...free,
    ...(start !== undefined && keep(start) ? { start: map(start) } : {}),
    ...(end !== undefined && keep(end) ? { end: map(end) } : {}),
  } as T;
}

/**
 * Shapes from outside (a file, storage, the clipboard): attachments to missing shapes
 * are dropped and every attached end is put back on its anchor, so a document built
 * from them always keeps the attachment invariants.
 */
export function settleAttachments(shapes: readonly Shape[]): Shape[] {
  const byId = new Map(shapes.map((shape) => [shape.id, shape]));
  return shapes.map((shape) =>
    shape.type === 'arrow'
      ? settleArrow(
          shape,
          (id) => byId.get(id),
          () => true,
        )
      : shape,
  );
}

/** Screen pixels around a shape within which its anchors show while an arrow end moves. */
export const ANCHOR_REACH_PX = 24;
/** Screen pixels from an anchor within which an arrow end snaps to it. */
export const ATTACH_PX = 12;

/** A shape whose anchors are showing, and the one an arrow end would attach to. */
export type AnchorHint = { readonly shapeId: ShapeId; readonly anchor: Anchor | null };

/** Where an arrow end near `point` would go: snapped to an anchor, or just hinted at. */
export type AnchorTarget = {
  readonly hint: AnchorHint;
  /** The anchor's position when `hint.anchor` is set. */
  readonly at: Point | null;
};

/**
 * The topmost shape that takes arrows within reach of `point` (world), and its nearest
 * anchor if within ATTACH_PX. `candidates` come from the spatial index; `avoid` is the
 * other end's attachment, so both ends never share one anchor.
 */
export function findAnchor(
  document: DocumentState,
  candidates: readonly ShapeId[],
  point: Readonly<Point>,
  zoom: number,
  avoid?: Attachment,
): AnchorTarget | null {
  const reach = ANCHOR_REACH_PX / zoom;
  let target: BoxShape | null = null;
  for (const id of candidates) {
    const shape = document.shapes.get(id);
    if (shape === undefined || !canAttachTo(shape)) continue;
    const bounds = shapeGeometryBounds(shape);
    const near =
      point.x >= bounds.minX - reach &&
      point.x <= bounds.maxX + reach &&
      point.y >= bounds.minY - reach &&
      point.y <= bounds.maxY + reach;
    if (near && (target === null || shape.zIndex > target.zIndex)) target = shape;
  }
  if (target === null) return null;
  let best: { anchor: Anchor; at: Point; gap: number } | null = null;
  for (const anchor of ANCHORS) {
    if (avoid?.shapeId === target.id && avoid.anchor === anchor) continue;
    const at = anchorPoint(target, anchor);
    const gap = distance(at, point);
    if (gap <= ATTACH_PX / zoom && (best === null || gap < best.gap)) best = { anchor, at, gap };
  }
  return {
    hint: { shapeId: target.id, anchor: best?.anchor ?? null },
    at: best?.at ?? null,
  };
}

/** The arrow with one end attached to `attachment`, or free when it is null. */
export function withEnd(arrow: ArrowShape, end: End, attachment: Attachment | null): ArrowShape {
  const { [end]: _old, ...rest } = arrow;
  return attachment === null ? rest : { ...rest, [end]: attachment };
}

/** What is wrong with an arrow's attachments, for the invariants checker. */
export function attachmentViolations(arrow: ArrowShape, shapeOf: Lookup): string[] {
  const points = pathWorldPoints(arrow);
  return ENDS.flatMap((end, i) => {
    const attachment = arrow[end];
    if (attachment === undefined) return [];
    const target = shapeOf(attachment.shapeId);
    if (target === undefined) {
      return [`${arrow.id}: ${end} is attached to ${attachment.shapeId}, which does not exist.`];
    }
    if (!canAttachTo(target)) {
      return [`${arrow.id}: ${end} is attached to a ${target.type}, which takes no arrows.`];
    }
    const at = points[i];
    const anchor = anchorPoint(target, attachment.anchor);
    return at !== undefined && distance(at, anchor) <= ON_ANCHOR
      ? []
      : [`${arrow.id}: ${end} is not on the ${attachment.anchor} of ${target.id}.`];
  });
}

/** Finds the anchor target near a world point; the editor wires it to the spatial index. */
export type AnchorFinder = (point: Readonly<Point>, avoid?: Attachment) => AnchorTarget | null;
