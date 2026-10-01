import { describe, expect, it } from 'vitest';
import { colors } from '../design/tokens';
import { EMPTY_DOCUMENT, insertShape } from './document';
import {
  createRenderer as createRendererWithLayout,
  type RenderContext,
  type Viewport,
} from './renderer';
import { createTextLayoutCache } from './text/layout';
import { DEFAULT_SHAPE_STYLE } from './shapes';
import { createEditorStore } from './store';
import {
  fakeMeasurer,
  makeArrow,
  makeEllipse,
  makeLine,
  makePen,
  makeRect,
  makeText,
  testShapeId,
} from './testing/factories';

/** Records every canvas call as a readable string, in order. */
function createRecordingContext() {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.join(',')})`);
    };
  const context: RenderContext = {
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    rect: record('rect'),
    ellipse: record('ellipse'),
    arc: record('arc'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    quadraticCurveTo: record('quadraticCurveTo'),
    fill: record('fill'),
    stroke: record('stroke'),
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    strokeStyle: '',
    fillStyle: '',
    fillText: record('fillText'),
    font: '',
    textBaseline: 'alphabetic',
  };
  return { context, calls };
}

const textLayouts = createTextLayoutCache(fakeMeasurer);
function createRenderer(context: RenderContext) {
  return createRendererWithLayout(context, (shape) => textLayouts.layout(shape));
}

const viewport: Viewport = { pixelWidth: 1600, pixelHeight: 1200, devicePixelRatio: 2 };

describe('createRenderer', () => {
  it('clears the whole backing store, then sets the camera transform once', () => {
    const { context, calls } = createRecordingContext();
    const state = createEditorStore({ camera: { x: 10, y: 20, zoom: 1.5 } }).getState();

    createRenderer(context).draw(state, viewport);

    expect(calls).toEqual([
      'setTransform(1,0,0,1,0,0)',
      'clearRect(0,0,1600,1200)',
      // scale = zoom × DPR = 3; offset = −camera × scale
      'setTransform(3,0,0,3,-30,-60)',
    ]);
  });

  it('draws shapes bottom to top, then the draft on top', () => {
    const { context, calls } = createRecordingContext();
    const document = [
      makeRect({ id: testShapeId('bottom'), width: 10, zIndex: 0 }),
      makeRect({ id: testShapeId('top'), width: 20, zIndex: 1 }),
    ].reduce(insertShape, EMPTY_DOCUMENT);
    const draft = makeRect({ id: testShapeId('draft'), width: 30 });
    const state = createEditorStore({ document, draft }).getState();

    createRenderer(context).draw(state, viewport);

    const rectWidths = calls.filter((c) => c.startsWith('rect(')).map((c) => c.split(',')[2]);
    expect(rectWidths).toEqual(['10', '20', '30']);
  });

  it('rotates a rectangle around its center', () => {
    const { context, calls } = createRecordingContext();
    const draft = makeRect({ x: 100, y: 50, width: 40, height: 20, rotation: 0.5 });
    createRenderer(context).draw(createEditorStore({ draft }).getState(), viewport);

    expect(calls).toContain('translate(120,60)');
    expect(calls).toContain('rotate(0.5)');
    expect(calls).toContain('rect(-20,-10,40,20)');
  });

  it('fills only shapes that have a fill color, and always strokes', () => {
    const { context, calls } = createRecordingContext();
    const filled = makeRect({ style: { ...DEFAULT_SHAPE_STYLE, fillColor: '#ff0000' } });
    createRenderer(context).draw(createEditorStore({ draft: filled }).getState(), viewport);
    expect(calls.filter((c) => c === 'fill()')).toHaveLength(1);
    expect(context.fillStyle).toBe('#ff0000');

    calls.length = 0;
    createRenderer(context).draw(createEditorStore({ draft: makeRect() }).getState(), viewport);
    expect(calls).not.toContain('fill()');
    expect(calls).toContain('stroke()');
  });

  it('applies the shape style before stroking', () => {
    const { context } = createRecordingContext();
    const style = { strokeColor: '#123456', fillColor: null, strokeWidth: 4, opacity: 0.5 };
    createRenderer(context).draw(
      createEditorStore({ draft: makeRect({ style }) }).getState(),
      viewport,
    );
    expect(context.strokeStyle).toBe('#123456');
    expect(context.lineWidth).toBe(4);
    expect(context.globalAlpha).toBe(0.5);
  });

  it('draws an ellipse inside its box, centered on the box center', () => {
    const { context, calls } = createRecordingContext();
    const draft = makeEllipse({ x: 10, y: 20, width: 60, height: 40 });
    createRenderer(context).draw(createEditorStore({ draft }).getState(), viewport);
    expect(calls).toContain('translate(40,40)');
    expect(calls).toContain(`ellipse(0,0,30,20,0,0,${String(Math.PI * 2)})`);
  });

  it('draws a line through its points, relative to the box center', () => {
    const { context, calls } = createRecordingContext();
    const draft = makeLine({
      x: 100,
      y: 100,
      points: [
        { x: 0, y: 40 },
        { x: 80, y: 0 },
      ],
    });
    createRenderer(context).draw(createEditorStore({ draft }).getState(), viewport);
    expect(calls).toContain('translate(140,120)');
    expect(calls).toContain('moveTo(-40,20)');
    expect(calls).toContain('lineTo(40,-20)');
  });

  it('adds two arrowhead strokes that start at the tip', () => {
    const { context, calls } = createRecordingContext();
    const draft = makeArrow({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    });
    createRenderer(context).draw(createEditorStore({ draft }).getState(), viewport);
    // Shaft start, plus one move to the tip for each side of the head.
    expect(calls.filter((c) => c.startsWith('moveTo('))).toEqual([
      'moveTo(-50,0)',
      'moveTo(50,0)',
      'moveTo(50,0)',
    ]);
  });

  it('smooths a pen path with one curve per inner point', () => {
    const { context, calls } = createRecordingContext();
    createRenderer(context).draw(createEditorStore({ draft: makePen() }).getState(), viewport);
    expect(calls.filter((c) => c.startsWith('quadraticCurveTo('))).toHaveLength(2);
    expect(context.lineCap).toBe('round');
  });

  it('never fills line, arrow, or pen shapes, even with a fill color', () => {
    const style = { ...DEFAULT_SHAPE_STYLE, fillColor: '#ff0000' };
    for (const draft of [makeLine({ style }), makeArrow({ style }), makePen({ style })]) {
      const { context, calls } = createRecordingContext();
      createRenderer(context).draw(createEditorStore({ draft }).getState(), viewport);
      expect(calls).not.toContain('fill()');
    }
  });

  it('draws text line by line on its baselines, in the stroke color, once fonts are ready', () => {
    const { context, calls } = createRecordingContext();
    // 240 wide at 10 per character: "Hello world again and" (210) fits; "again" wraps.
    const draft = makeText({
      x: 0,
      y: 0,
      width: 240,
      height: 40,
      text: 'Hello world again and again',
    });
    createRenderer(context).draw(
      createEditorStore({ draft, fontsReady: true }).getState(),
      viewport,
    );

    expect(calls.filter((c) => c.startsWith('fillText('))).toEqual([
      // Left edge −120; first baseline at −20 (top) + 16 (ascent); next line 20 lower.
      'fillText(Hello world again and,-120,-4)',
      'fillText(again,-120,16)',
    ]);
    expect(context.fillStyle).toBe(DEFAULT_SHAPE_STYLE.strokeColor);
    expect(context.font).toBe('20px "Instrument Sans", system-ui, sans-serif');
    expect(calls).not.toContain('stroke()');
  });

  it('draws no text until fonts are ready', () => {
    const { context, calls } = createRecordingContext();
    createRenderer(context).draw(createEditorStore({ draft: makeText() }).getState(), viewport);
    expect(calls.some((c) => c.startsWith('fillText('))).toBe(false);
  });

  it('draws moved shapes from the preview, in their place in the draw order', () => {
    const { context, calls } = createRecordingContext();
    const bottom = makeRect({ id: testShapeId('bottom'), width: 10, zIndex: 0 });
    const top = makeRect({ id: testShapeId('top'), width: 20, zIndex: 1 });
    const document = [bottom, top].reduce(insertShape, EMPTY_DOCUMENT);
    const preview = new Map([[bottom.id, { ...bottom, x: 500 }]]);
    createRenderer(context).draw(createEditorStore({ document, preview }).getState(), viewport);
    expect(calls.filter((c) => c.startsWith('translate('))).toEqual([
      'translate(505,25)',
      'translate(10,25)',
    ]);
  });

  it('draws the selection overlay last, in device pixels, on pixel centers', () => {
    const { context, calls } = createRecordingContext();
    const rect = makeRect({ x: 10, y: 20, width: 100, height: 50 });
    const document = insertShape(EMPTY_DOCUMENT, rect);
    const state = createEditorStore({ document, selectedIds: new Set([rect.id]) }).getState();
    createRenderer(context).draw(state, { ...viewport, devicePixelRatio: 1 });

    const overlay = calls.slice(calls.lastIndexOf('setTransform(1,0,0,1,0,0)'));
    // The frame comes first, on half-pixel coordinates so a 1 px line is crisp.
    expect(overlay.slice(0, 8)).toEqual([
      'setTransform(1,0,0,1,0,0)',
      'beginPath()',
      'moveTo(10.5,20.5)',
      'lineTo(110.5,20.5)',
      'lineTo(110.5,70.5)',
      'lineTo(10.5,70.5)',
      'closePath()',
      'stroke()',
    ]);
    // Then 8 square resize handles and 1 round rotation handle, each filled and outlined.
    expect(overlay.filter((c) => c === 'fill()')).toHaveLength(9);
    expect(overlay.filter((c) => c.startsWith('arc('))).toEqual([
      `arc(60,-4,4.5,0,${String(Math.PI * 2)})`,
    ]);
    // The bottom-right handle is an 8 px square centered on the corner, snapped to pixels.
    expect(overlay).toContain('moveTo(106.5,66.5)');
    expect(context.strokeStyle).toBe(colors.light.select);
    expect(context.lineWidth).toBe(1);
  });

  it('shows only end handles for a lone line, and no handles mid-gesture', () => {
    const line = makeLine();
    const document = insertShape(EMPTY_DOCUMENT, line);
    const selected = { document, selectedIds: new Set([line.id]) };

    const idle = createRecordingContext();
    createRenderer(idle.context).draw(createEditorStore(selected).getState(), viewport);
    const idleOverlay = idle.calls.slice(idle.calls.lastIndexOf('setTransform(1,0,0,1,0,0)'));
    expect(idleOverlay.filter((c) => c.startsWith('arc('))).toHaveLength(2);
    expect(idleOverlay.filter((c) => c === 'stroke()')).toHaveLength(2);

    const moving = createRecordingContext();
    const preview = new Map([[line.id, { ...line, x: 50 }]]);
    createRenderer(moving.context).draw(
      createEditorStore({ ...selected, preview }).getState(),
      viewport,
    );
    const movingOverlay = moving.calls.slice(moving.calls.lastIndexOf('setTransform(1,0,0,1,0,0)'));
    expect(movingOverlay.some((c) => c.startsWith('arc('))).toBe(false);
  });

  it('outlines each shape and the shared frame for a multi-selection, plus the marquee', () => {
    const { context, calls } = createRecordingContext();
    const a = makeRect({ id: testShapeId('a'), zIndex: 0 });
    const b = makeRect({ id: testShapeId('b'), x: 200, zIndex: 1 });
    const document = [a, b].reduce(insertShape, EMPTY_DOCUMENT);
    const marquee = { minX: 0, minY: 0, maxX: 50, maxY: 50 };
    const state = createEditorStore({
      document,
      selectedIds: new Set([a.id, b.id]),
      marquee,
    }).getState();
    createRenderer(context).draw(state, viewport);

    // Two shape outlines + one frame are stroked; the marquee is filled and stroked;
    // handles are hidden while the marquee is out.
    const overlay = calls.slice(calls.lastIndexOf('setTransform(1,0,0,1,0,0)'));
    expect(overlay.filter((c) => c === 'stroke()')).toHaveLength(4);
    expect(overlay.filter((c) => c === 'fill()')).toHaveLength(1);
    // At DPR 2 the line is 2 device pixels wide, so edges sit on pixel boundaries.
    expect(overlay).toContain('moveTo(0,0)');
  });
});
