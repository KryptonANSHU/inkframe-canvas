import { describe, expect, it } from 'vitest';
import { worldToScreen } from './camera';
import { documentFromShapes } from './persistence/fileFormat';
import { createEditorStore } from './store';
import { makeRect } from './testing/factories';
import { steppedZoom, zoomView } from './view';

describe('zoom', () => {
  it('steps through the preset levels, snapping from in between', () => {
    expect(steppedZoom(1, 1)).toBe(1.5);
    expect(steppedZoom(1, -1)).toBe(0.75);
    expect(steppedZoom(1.2, 1)).toBe(1.5);
    expect(steppedZoom(1.2, -1)).toBe(1);
    expect(steppedZoom(4, 1)).toBe(4);
  });

  it('zooms around the middle of the view, and fits the drawing with padding', () => {
    const rect = makeRect({ x: 0, y: 0, width: 1000, height: 100 });
    const store = createEditorStore({ document: documentFromShapes([rect]) });
    zoomView(store, 'in', 800, 600);
    expect(worldToScreen(store.getState().camera, { x: 400, y: 300 })).toEqual({ x: 400, y: 300 });
    zoomView(store, 'fit', 800, 600);
    const { camera } = store.getState();
    // The drawing's middle (with its stroke and export padding) lands mid-view.
    expect(worldToScreen(camera, { x: 500, y: 50 }).x).toBeCloseTo(400);
    expect(camera.zoom).toBeLessThan(1);
  });
});
