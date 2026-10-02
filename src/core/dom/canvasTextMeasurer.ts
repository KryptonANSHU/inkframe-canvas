import type { TextFont } from '../shapes';
import { fontString } from '../text/font';
import type { FontMetrics, TextMeasurer } from '../text/layout';

/** The part of a 2D context (on-screen or offscreen, as in workers) used to measure. */
export type MeasuringContext = Pick<CanvasRenderingContext2D, 'font' | 'measureText'>;

/** A measurer over a private on-screen canvas, for the editor. */
export function createCanvasTextMeasurer(): TextMeasurer & { reset(): void } {
  const context = document.createElement('canvas').getContext('2d');
  if (context === null) {
    throw new Error(
      "This browser can't measure text on a canvas. Open Inkframe in a recent browser.",
    );
  }
  return createContextTextMeasurer(context);
}

/**
 * Measures with a 2D context: width from measureText, line height from the font's own
 * bounding-box metrics. Results are cached until reset (call it when fonts load, since
 * widths measured with a fallback font are wrong).
 */
export function createContextTextMeasurer(
  context: MeasuringContext,
): TextMeasurer & { reset(): void } {
  let widths = new Map<string, number>();
  let metrics = new Map<string, FontMetrics>();

  const useFont = (fontSize: number, face: TextFont) => {
    const font = fontString(fontSize, face);
    if (context.font !== font) {
      context.font = font;
    }
  };

  return {
    width(text, fontSize, face = 'sans') {
      const key = `${face}|${String(fontSize)}|${text}`;
      const cached = widths.get(key);
      if (cached !== undefined) {
        return cached;
      }
      useFont(fontSize, face);
      const width = context.measureText(text).width;
      widths.set(key, width);
      return width;
    },
    metrics(fontSize, face = 'sans') {
      const key = `${face}|${String(fontSize)}`;
      const cached = metrics.get(key);
      if (cached !== undefined) {
        return cached;
      }
      useFont(fontSize, face);
      const { fontBoundingBoxAscent, fontBoundingBoxDescent } = context.measureText('M');
      const measured = {
        ascent: fontBoundingBoxAscent,
        lineHeight: fontBoundingBoxAscent + fontBoundingBoxDescent,
      };
      metrics.set(key, measured);
      return measured;
    },
    reset() {
      widths = new Map();
      metrics = new Map();
    },
  };
}
