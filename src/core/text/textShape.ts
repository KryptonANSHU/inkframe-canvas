import { DEFAULT_SHAPE_STYLE, MIN_SHAPE_SIZE, type ShapeId, type TextShape } from '../shapes';
import { DEFAULT_FONT_SIZE, DEFAULT_TEXT_WIDTH } from './font';
import { layoutText, type TextMeasurer } from './layout';

export type TextPlacement = { readonly id: ShapeId; readonly x: number; readonly y: number };

/**
 * The shape for text typed at `placement`, or null when there is nothing to keep.
 * Trailing whitespace is dropped so blank lines at the end don't add invisible height.
 * Height is measured now, with the loaded font, and stored on the shape.
 */
export function createTextShape(
  placement: TextPlacement,
  typed: string,
  measurer: TextMeasurer,
): TextShape | null {
  const text = typed.trimEnd();
  if (text === '') {
    return null;
  }
  const layout = layoutText(text, DEFAULT_TEXT_WIDTH, DEFAULT_FONT_SIZE, measurer);
  return {
    id: placement.id,
    type: 'text',
    x: placement.x,
    y: placement.y,
    width: DEFAULT_TEXT_WIDTH,
    height: Math.max(MIN_SHAPE_SIZE, layout.height),
    text,
    fontSize: DEFAULT_FONT_SIZE,
    rotation: 0,
    style: DEFAULT_SHAPE_STYLE,
    zIndex: 0,
  };
}
