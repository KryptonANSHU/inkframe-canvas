import type { TextFont, TextShape } from '../shapes';

/**
 * Canvas text faces, self-hosted from public/fonts (all SIL OFL 1.1). The UI itself is
 * set in Instrument Sans; drawings default to the hand-drawn face.
 */
export const TEXT_FACES: Readonly<
  Record<TextFont, { readonly family: string; readonly file: string; readonly fallback: string }>
> = {
  hand: {
    family: 'Shantell Sans',
    file: 'shantell-sans-latin-400-normal.woff2',
    fallback: 'cursive',
  },
  sans: {
    family: 'Instrument Sans',
    file: 'instrument-sans-latin-400-normal.woff2',
    fallback: 'system-ui, sans-serif',
  },
  mono: {
    family: 'JetBrains Mono',
    file: 'jetbrains-mono-latin-400-normal.woff2',
    fallback: 'ui-monospace, monospace',
  },
};

/** New text is hand-drawn, as in sketching tools. */
export const DEFAULT_TEXT_FONT: TextFont = 'hand';

export const DEFAULT_FONT_SIZE = 20;
/** Wrap width for a new text box, in world units. */
export const DEFAULT_TEXT_WIDTH = 240;

/** A text shape's face: older text without one is Normal. */
export function textFont(shape: Pick<TextShape, 'font'>): TextFont {
  return shape.font ?? 'sans';
}

/** The CSS font shorthand used by the canvas, the text editor overlay, and measuring. */
export function fontString(fontSize: number, font: TextFont = 'sans'): string {
  const face = TEXT_FACES[font];
  return `${String(fontSize)}px "${face.family}", ${face.fallback}`;
}
