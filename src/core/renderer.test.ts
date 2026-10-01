import { describe, expect, it } from 'vitest';
import { EMPTY_DOCUMENT, insertShape } from './document';
import { createRenderer, type RenderContext, type Viewport } from './renderer';
import { DEFAULT_SHAPE_STYLE } from './shapes';
import { createEditorStore } from './store';
import { makeRect, testShapeId } from './testing/factories';

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
    rect: record('rect'),
    fill: record('fill'),
    stroke: record('stroke'),
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: '',
    fillStyle: '',
  };
  return { context, calls };
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
});
