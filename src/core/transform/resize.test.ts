import { describe, expect, it } from 'vitest';
import { selectionFrame } from '../selection/selectionFrame';
import type { Shape } from '../shapes';
import {
  fakeMeasurer,
  makeEllipse,
  makeLine,
  makeRect,
  makeText,
  testShapeId,
} from '../testing/factories';
import { resizeFromHandle, resizeShapes, shapeScale, type HandleDirection } from './resize';

const plain = { fromCenter: false, keepAspect: false };
// A 100 × 50 frame centered on the origin.
const frame = { centerX: 0, centerY: 0, width: 100, height: 50, rotation: 0 };
const se: HandleDirection = { x: 1, y: 1 };
const e: HandleDirection = { x: 1, y: 0 };

function resizeOne(
  shape: Shape,
  direction: HandleDirection,
  target: { x: number; y: number },
  options = plain,
) {
  const shapeFrame = selectionFrame([shape]);
  if (shapeFrame === null) throw new Error('no frame');
  const result = resizeFromHandle(shapeFrame, direction, target, options);
  const [resized] = resizeShapes([shape], shapeFrame, result, fakeMeasurer);
  return resized;
}

describe('resizeFromHandle', () => {
  it('scales from the opposite corner', () => {
    const result = resizeFromHandle(frame, se, { x: 150, y: 75 }, plain);
    expect(result).toEqual({ scaleX: 2, scaleY: 2, centerShift: { x: 50, y: 25 } });
  });

  it('moves only one axis from an edge handle', () => {
    expect(resizeFromHandle(frame, e, { x: 100, y: 999 }, plain)).toMatchObject({
      scaleX: 1.5,
      scaleY: 1,
    });
  });

  it('with Alt, scales around the center', () => {
    expect(resizeFromHandle(frame, se, { x: 100, y: 50 }, { ...plain, fromCenter: true })).toEqual({
      scaleX: 2,
      scaleY: 2,
      centerShift: { x: 0, y: 0 },
    });
  });

  it('flips when dragged past the anchor', () => {
    expect(resizeFromHandle(frame, e, { x: -150, y: 0 }, plain).scaleX).toBe(-1);
  });

  it('with Shift, keeps the aspect ratio; the larger change wins', () => {
    const corner = resizeFromHandle(frame, se, { x: 150, y: 0 }, { ...plain, keepAspect: true });
    expect([corner.scaleX, corner.scaleY]).toEqual([2, 2]);
    const edge = resizeFromHandle(frame, e, { x: 150, y: 0 }, { ...plain, keepAspect: true });
    expect([edge.scaleX, edge.scaleY]).toEqual([2, 2]);
    expect(edge.centerShift.y).toBe(0);
  });

  it('never goes below 1 world unit, and leaves a zero-size axis alone', () => {
    expect(resizeFromHandle(frame, e, { x: -50, y: 0 }, plain).scaleX).toBe(0.01);
    expect(resizeFromHandle({ ...frame, height: 0 }, se, { x: 50, y: 30 }, plain).scaleY).toBe(1);
  });
});

describe('shapeScale', () => {
  it('passes scale straight through at 0° and π, and swaps axes at 90°', () => {
    expect(shapeScale(0, 2, 3)).toEqual({ rotation: 0, scaleX: 2, scaleY: 3 });
    expect(shapeScale(Math.PI, 2, 3)).toEqual({ rotation: Math.PI, scaleX: 2, scaleY: 3 });
    expect(shapeScale(Math.PI / 2, 2, 3)).toEqual({ rotation: Math.PI / 2, scaleX: 3, scaleY: 2 });
  });

  it('turns a single-axis flip of a rotated shape into a mirrored rotation', () => {
    expect(shapeScale(0.3, -2, 2)).toEqual({ rotation: -0.3, scaleX: -2, scaleY: 2 });
    expect(shapeScale(0.3, 2, -2)).toEqual({ rotation: Math.PI - 0.3, scaleX: -2, scaleY: 2 });
    expect(shapeScale(0.3, -2, -2)).toEqual({ rotation: 0.3 + Math.PI, scaleX: 2, scaleY: 2 });
  });
});

describe('resizeShapes', () => {
  it('resizes a rectangle from its corner, keeping the opposite corner fixed', () => {
    const rect = makeRect({ x: 0, y: 0, width: 100, height: 50 });
    expect(resizeOne(rect, se, { x: 100, y: 75 })).toMatchObject({
      x: 0,
      y: 0,
      width: 150,
      height: 100,
    });
  });

  it('bakes a flip into the geometry: a line is mirrored, a box stays positive', () => {
    const line = makeLine({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ],
    });
    // Drag the right edge 100 units left of the left edge.
    const flipped = resizeOne(line, e, { x: -150, y: 0 });
    expect(flipped).toMatchObject({
      x: -100,
      points: [
        { x: 100, y: 0 },
        { x: 0, y: 50 },
      ],
    });
    expect(resizeOne(makeEllipse(), e, { x: -150, y: 0 })).toMatchObject({ x: -100, width: 100 });
  });

  it('changes text wrap width from a side and re-measures its height', () => {
    const text = makeText({ text: 'Hello brave new world', width: 240, height: 20 });
    // Narrow to 120: "Hello brave" / "new world" (fake measurer: 10 per character).
    expect(resizeOne(text, e, { x: 0, y: 0 })).toMatchObject({
      width: 120,
      height: 40,
      fontSize: 20,
    });
  });

  it('scales text font size with a uniform corner resize', () => {
    const text = makeText({ text: 'Hi', width: 240, height: 20 });
    expect(resizeOne(text, se, { x: 360, y: 20 }, { ...plain, keepAspect: true })).toMatchObject({
      width: 480,
      fontSize: 40,
    });
  });

  it('scales a 90°-rotated member of a group along the right local axis', () => {
    const upright = makeRect({ id: testShapeId('a'), x: 0, y: 0, width: 100, height: 20 });
    const turned = makeRect({
      id: testShapeId('b'),
      x: 200,
      y: 0,
      width: 100,
      height: 20,
      rotation: Math.PI / 2,
    });
    const groupFrame = selectionFrame([upright, turned]);
    if (groupFrame === null) throw new Error('no frame');
    // Stretch the group to twice its height only.
    const result = { scaleX: 1, scaleY: 2, centerShift: { x: 0, y: 0 } };
    const [a, b] = resizeShapes([upright, turned], groupFrame, result, fakeMeasurer);
    expect(a).toMatchObject({ width: 100, height: 40 });
    // Turned 90°, its own width runs vertically, so its width doubles instead.
    expect(b).toMatchObject({ width: 200, height: 20 });
  });
});
