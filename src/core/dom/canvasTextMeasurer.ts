import { fontString } from '../text/font';
import type { FontMetrics, TextMeasurer } from '../text/layout';

/**
 * Measures with a private 2D context: width from measureText, line height from the
 * font's own bounding-box metrics. Results are cached until reset (call it when fonts
 * load, since widths measured with a fallback font are wrong).
 */
export function createCanvasTextMeasurer(): TextMeasurer & { reset(): void } {
  const context = document.createElement('canvas').getContext('2d');
  if (context === null) {
    throw new Error(
      "This browser can't measure text on a canvas. Open Inkframe in a recent browser.",
    );
  }
  let widths = new Map<string, number>();
  let metrics = new Map<number, FontMetrics>();

  const useFont = (fontSize: number) => {
    const font = fontString(fontSize);
    if (context.font !== font) {
      context.font = font;
    }
  };

  return {
    width(text, fontSize) {
      const key = `${String(fontSize)}|${text}`;
      const cached = widths.get(key);
      if (cached !== undefined) {
        return cached;
      }
      useFont(fontSize);
      const width = context.measureText(text).width;
      widths.set(key, width);
      return width;
    },
    metrics(fontSize) {
      const cached = metrics.get(fontSize);
      if (cached !== undefined) {
        return cached;
      }
      useFont(fontSize);
      const { fontBoundingBoxAscent, fontBoundingBoxDescent } = context.measureText('M');
      const measured = {
        ascent: fontBoundingBoxAscent,
        lineHeight: fontBoundingBoxAscent + fontBoundingBoxDescent,
      };
      metrics.set(fontSize, measured);
      return measured;
    },
    reset() {
      widths = new Map();
      metrics = new Map();
    },
  };
}
