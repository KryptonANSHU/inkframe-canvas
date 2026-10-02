import { DEFAULT_SHAPE_STYLE, MIN_SHAPE_SIZE, type ShapeId, type TextShape } from '../shapes';
import { DEFAULT_FONT_SIZE, DEFAULT_TEXT_FONT, DEFAULT_TEXT_WIDTH, textFont } from './font';
import { layoutText, type TextMeasurer } from './layout';

export type TextPlacement = { readonly id: ShapeId; readonly x: number; readonly y: number };

/** A text box open for typing: a new one at (x, y), or an existing shape. */
export type TextEdit = TextPlacement & {
  /** The shape as it was when editing began, or null for new text. */
  readonly original: TextShape | null;
};

export function editExisting(shape: TextShape): TextEdit {
  return { id: shape.id, x: shape.x, y: shape.y, original: shape };
}

/**
 * The shape for text typed at `placement`, or null when there is nothing to keep.
 * Height is measured now, with the loaded font, and stored on the shape.
 */
export function createTextShape(
  placement: TextPlacement,
  typed: string,
  measurer: TextMeasurer,
): TextShape | null {
  const empty: TextShape = {
    id: placement.id,
    type: 'text',
    x: placement.x,
    y: placement.y,
    width: DEFAULT_TEXT_WIDTH,
    height: MIN_SHAPE_SIZE,
    text: '',
    fontSize: DEFAULT_FONT_SIZE,
    font: DEFAULT_TEXT_FONT,
    rotation: 0,
    style: DEFAULT_SHAPE_STYLE,
    zIndex: 0,
  };
  return withText(empty, typed, measurer);
}

/** Text from a file, re-measured with this browser's font; null if it is blank. */
export function remeasured(shape: TextShape, measurer: TextMeasurer): TextShape | null {
  return withText(shape, shape.text, measurer);
}

/**
 * `shape` holding `typed`, re-measured at its width and font size; null when the text
 * is blank. Trailing whitespace is dropped so blank lines at the end add no height.
 */
export function withText(
  shape: TextShape,
  typed: string,
  measurer: TextMeasurer,
): TextShape | null {
  const text = typed.trimEnd();
  if (text === '') {
    return null;
  }
  const layout = layoutText(text, shape.width, shape.fontSize, measurer, textFont(shape));
  return { ...shape, text, height: Math.max(MIN_SHAPE_SIZE, layout.height) };
}
