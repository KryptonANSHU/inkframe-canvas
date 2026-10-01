import { describe, expect, it } from 'vitest';
import { createEditorStore } from '../store';
import { documentFromShapes } from '../persistence/fileFormat';
import { fakeMeasurer, makeArrow, makeRect, makeText, testShapeId } from '../testing/factories';
import { layoutText } from '../text/layout';
import { EXPORT_PADDING, exportBounds, shapesToExport } from './exportArea';
import { PNG_SCALE, pngScale } from './pngScale';
import { shapesToSvg } from './svg';

const rect = makeRect({ id: testShapeId('r'), x: 0, y: 0, width: 100, height: 50 });
const arrow = makeArrow({ id: testShapeId('a'), x: 200, y: 0 });
const textLayout = (shape: { text: string; width: number; fontSize: number }) =>
  layoutText(shape.text, shape.width, shape.fontSize, fakeMeasurer);

describe('export area', () => {
  it('exports the selection, or everything when nothing is selected', () => {
    const state = createEditorStore({ document: documentFromShapes([rect, arrow]) }).getState();
    expect(shapesToExport(state).map((shape) => shape.id)).toEqual(['r', 'a']);
    const selected = { ...state, selectedIds: new Set([arrow.id]) };
    expect(shapesToExport(selected).map((shape) => shape.id)).toEqual(['a']);
  });

  it("covers every shape's ink plus padding, and nothing when empty", () => {
    // The 2-unit stroke adds 2 on each side (inkMargin), then the padding.
    expect(exportBounds([rect])).toEqual({
      minX: -2 - EXPORT_PADDING,
      minY: -2 - EXPORT_PADDING,
      maxX: 102 + EXPORT_PADDING,
      maxY: 52 + EXPORT_PADDING,
    });
    expect(exportBounds([])).toBeNull();
  });
});

describe('pngScale', () => {
  it('uses the full scale for normal drawings and shrinks huge ones to fit', () => {
    expect(pngScale(800, 600)).toBe(PNG_SCALE);
    expect(pngScale(100_000, 10) * 100_000).toBeLessThanOrEqual(16_384);
    expect(pngScale(8000, 8000) ** 2 * 8000 * 8000).toBeLessThanOrEqual(16_777_216 + 1);
  });
});

describe('shapesToSvg', () => {
  const area = { minX: -20, minY: -20, maxX: 120, maxY: 70 };

  it('sizes the document to the export area', () => {
    expect(shapesToSvg([], area, textLayout, null)).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" width="140" height="90" viewBox="-20 -20 140 90"></svg>',
    );
  });

  it('draws each shape centered on its box and rotated around it, like the canvas', () => {
    const turned = { ...rect, rotation: Math.PI / 2 };
    const svg = shapesToSvg([turned], area, textLayout, null);
    expect(svg).toContain('<g transform="translate(50 25) rotate(90)" opacity="1">');
    expect(svg).toContain('<rect x="-50" y="-25" width="100" height="50" fill="none"');
    expect(svg).toContain('stroke-linejoin="miter"');
  });

  it('draws an arrow as its line plus two head strokes from the tip', () => {
    const svg = shapesToSvg([arrow], area, textLayout, null);
    expect(svg.match(/M/g)).toHaveLength(3);
  });

  it('escapes text, keeps its spaces, and embeds the font only when there is text', () => {
    const text = makeText({ id: testShapeId('t'), text: 'a  <b> & "c"', width: 500 });
    const svg = shapesToSvg([text], area, textLayout, '@font-face{}');
    expect(svg).toContain('<style>@font-face{}</style>');
    expect(svg).toContain('>a  &lt;b&gt; &amp; &quot;c&quot;</tspan>');
    expect(svg).toContain('xml:space="preserve"');
    expect(shapesToSvg([rect], area, textLayout, '@font-face{}')).not.toContain('<style>');
  });
});
