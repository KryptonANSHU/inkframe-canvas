import type { TextShape } from '../shapes';

export type FontMetrics = {
  /** Baseline offset from the top of a line. */
  readonly ascent: number;
  readonly lineHeight: number;
};

/** Measures text in a given font size. The browser version wraps canvas measureText. */
export type TextMeasurer = {
  width(text: string, fontSize: number): number;
  metrics(fontSize: number): FontMetrics;
};

export type TextLine = { readonly text: string; readonly width: number };

export type TextLayout = FontMetrics & {
  readonly lines: readonly TextLine[];
  readonly height: number;
};

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Greedy word wrap inside `maxWidth`. Line breaks typed by the user are kept; a word
 * wider than the box breaks between graphemes, so emoji and accents stay whole.
 */
export function layoutText(
  text: string,
  maxWidth: number,
  fontSize: number,
  measurer: TextMeasurer,
): TextLayout {
  const measure = (value: string) => measurer.width(value, fontSize);
  const lines = text
    .split('\n')
    .flatMap((paragraph) => wrapParagraph(paragraph, maxWidth, measure))
    .map((line) => ({ text: line, width: measure(line) }));
  const metrics = measurer.metrics(fontSize);
  return { ...metrics, lines, height: lines.length * metrics.lineHeight };
}

function wrapParagraph(
  paragraph: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const lines: string[] = [];
  let line = '';
  // Words with their trailing spaces, so spacing inside a line is kept exactly.
  for (const token of paragraph.match(/\S+\s*|\s+/g) ?? []) {
    if (measure((line + token).trimEnd()) <= maxWidth) {
      line += token;
      continue;
    }
    if (line !== '') {
      lines.push(line.trimEnd());
    }
    // Every piece but the last fills a line; the last one starts the next line.
    const pieces = breakLongWord(token, maxWidth, measure);
    for (const piece of pieces.slice(0, -1)) {
      lines.push(piece.trimEnd());
    }
    line = pieces.at(-1) ?? '';
  }
  lines.push(line.trimEnd());
  return lines;
}

/** Splits a token into pieces that each fit, at least one grapheme per piece. */
function breakLongWord(
  token: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  if (measure(token.trimEnd()) <= maxWidth) {
    return [token];
  }
  const pieces: string[] = [];
  let piece = '';
  for (const { segment } of graphemes.segment(token)) {
    if (piece !== '' && measure((piece + segment).trimEnd()) > maxWidth) {
      pieces.push(piece);
      piece = '';
    }
    piece += segment;
  }
  pieces.push(piece);
  return pieces;
}

/** Layouts cached per shape object (shapes are immutable). Reset when fonts change. */
export function createTextLayoutCache(measurer: TextMeasurer) {
  let cache = new WeakMap<TextShape, TextLayout>();
  return {
    layout(shape: TextShape): TextLayout {
      const cached = cache.get(shape);
      if (cached !== undefined) {
        return cached;
      }
      const layout = layoutText(shape.text, shape.width, shape.fontSize, measurer);
      cache.set(shape, layout);
      return layout;
    },
    reset() {
      cache = new WeakMap();
    },
  };
}

export type TextLayoutCache = ReturnType<typeof createTextLayoutCache>;
