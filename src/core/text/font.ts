/** The one font for canvas text, self-hosted from public/fonts (OFL 1.1). */
export const TEXT_FONT_FAMILY = 'Instrument Sans';

export const DEFAULT_FONT_SIZE = 20;
/** Wrap width for a new text box, in world units. */
export const DEFAULT_TEXT_WIDTH = 240;

/** The CSS font shorthand used by both the canvas and the text editor overlay. */
export function fontString(fontSize: number): string {
  return `${String(fontSize)}px "${TEXT_FONT_FAMILY}", system-ui, sans-serif`;
}
