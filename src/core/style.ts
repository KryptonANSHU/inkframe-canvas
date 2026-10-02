import { executeCommand, updateShapesCommand } from './commands';
import type { HistoryGroup } from './history';
import { selectedShapes } from './selection/selectedShapes';
import { reshapeCommand } from './attachments';
import type { Shape, ShapeStyle, TextFont, TextShape } from './shapes';
import { textFont } from './text/font';
import type { TextMeasurer } from './text/layout';
import { withText } from './text/textShape';
import type { EditorStore } from './store';

/** A value shared by every selected shape, or 'mixed' when they differ. */
export type Shared<T> = T | 'mixed';

/** What the style panel shows for the current selection. */
export type SelectionStyle = {
  readonly strokeColor: Shared<string>;
  /** Null (no fill) is a real value; undefined when no selected shape can be filled. */
  readonly fillColor: Shared<string | null> | undefined;
  readonly strokeWidth: Shared<number>;
  readonly opacity: Shared<number>;
  /** False when only text is selected: text has no stroke width. */
  readonly hasStroke: boolean;
  /** The selected text's face; undefined when no text is selected. */
  readonly font: Shared<TextFont> | undefined;
};

/** Rectangles and ellipses can be filled; paths and text can't (as in `isFilled`). */
export function canFill(shape: Shape): boolean {
  return shape.type === 'rectangle' || shape.type === 'ellipse';
}

export function selectionStyle(shapes: readonly Shape[]): SelectionStyle | null {
  const [first] = shapes;
  if (first === undefined) {
    return null;
  }
  const shared = <T>(read: (shape: Shape) => T, among: readonly Shape[] = shapes): Shared<T> => {
    const value = read(among[0] ?? first);
    return among.every((shape) => read(shape) === value) ? value : 'mixed';
  };
  const fillable = shapes.filter(canFill);
  const stroked = shapes.filter((shape) => shape.type !== 'text');
  const texts = shapes.filter((shape) => shape.type === 'text');
  return {
    strokeColor: shared((shape) => shape.style.strokeColor.toLowerCase()),
    fillColor:
      fillable.length === 0
        ? undefined
        : shared((shape) => shape.style.fillColor?.toLowerCase() ?? null, fillable),
    strokeWidth: stroked.length === 0 ? 'mixed' : shared((s) => s.style.strokeWidth, stroked),
    opacity: shared((shape) => shape.style.opacity),
    hasStroke: stroked.length > 0,
    font: texts.length === 0 ? undefined : shared((shape) => textFontOf(shape), texts),
  };
}

/**
 * Applies a style change to every selected shape as one undo step. Fill only reaches
 * shapes that can be filled. With `group`, a slider drag's many changes join one step.
 */
export function applyStyle(
  store: EditorStore,
  patch: Partial<ShapeStyle>,
  reportError: (error: Error) => void,
  group?: HistoryGroup,
): void {
  const before = selectedShapes(store.getState());
  const after = before.map((shape) => restyled(shape, patch));
  if (after.every((shape, i) => shape === before[i])) {
    return;
  }
  const command = updateShapesCommand('Change style', before, after);
  const result = executeCommand(store, command, group === undefined ? {} : { group });
  if (!result.ok) {
    reportError(result.error);
  }
}

/**
 * Sets the face of every selected text as one undo step. Text is measured again in the
 * new face (its height changes), and attached arrows follow.
 */
export function applyTextFont(
  store: EditorStore,
  font: TextFont,
  measurer: TextMeasurer,
  reportError: (error: Error) => void,
): void {
  const before = selectedShapes(store.getState()).filter(
    (shape): shape is TextShape => shape.type === 'text' && textFont(shape) !== font,
  );
  const after = before.flatMap((shape) => withText({ ...shape, font }, shape.text, measurer) ?? []);
  if (after.length === 0 || after.length !== before.length) return;
  const command = reshapeCommand(store.getState().document, 'Change font', before, after);
  const result = executeCommand(store, command);
  if (!result.ok) reportError(result.error);
}

/** Any shape's face, for shared(): only ever asked of text. */
function textFontOf(shape: Shape): TextFont {
  return shape.type === 'text' ? textFont(shape) : 'sans';
}

function restyled(shape: Shape, patch: Partial<ShapeStyle>): Shape {
  const { fillColor, ...rest } = patch;
  const style: ShapeStyle = {
    ...shape.style,
    ...rest,
    ...(fillColor !== undefined && canFill(shape) ? { fillColor } : {}),
  };
  const changed = (Object.keys(style) as (keyof ShapeStyle)[]).some(
    (key) => style[key] !== shape.style[key],
  );
  return changed ? { ...shape, style } : shape;
}
