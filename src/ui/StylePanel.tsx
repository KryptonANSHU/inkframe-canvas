import { ArrowDown, ArrowUp, BringToFront, Group, SendToBack, Ungroup } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { canGroup } from '../core/groups';
import { selectedShapes } from '../core/selection/selectedShapes';
import type { TextFont } from '../core/shapes';
import { selectionStyle, type Shared } from '../core/style';
import {
  ColorPicker,
  fillSwatches,
  IconButton,
  SegmentedControl,
  Slider,
  strokeSwatches,
  Surface,
  type ShapeSwatch,
  type ThemeName,
} from '@inkframe/design';
import { useEditor, useEditorState } from './EditorContext';
import styles from './StylePanel.module.css';
import { useBackToCanvas } from './useBackToCanvas';

const WIDTHS: readonly { value: number; label: string; drawn: number }[] = [
  { value: 1, label: 'Thin', drawn: 1 },
  { value: 2, label: 'Regular', drawn: 2 },
  { value: 4, label: 'Bold', drawn: 3.5 },
  { value: 8, label: 'Heavy', drawn: 5 },
];
const NO_FILL = 'none';
const OPACITY_MIN = 10;
const OPACITY_STEP = 5;

/** The style of the selection: colors, stroke width, opacity, and layer order, right side. */
export function StylePanel() {
  const editor = useEditor();
  const backToCanvas = useBackToCanvas();
  // Selected separately: each selector returns primitives (or an object of them), so
  // the shallow comparison sees "unchanged" and the panel re-renders only on a change.
  const style = useEditorState((state) => selectionStyle(selectedShapes(state)));
  const theme = useEditorState((state) => state.theme);
  const editingText = useEditorState((state) => state.textEdit !== null);
  const grouping = useEditorState((state) => {
    const shapes = selectedShapes(state);
    return {
      canGroup: canGroup(shapes),
      canUngroup: shapes.some((shape) => shape.groupId !== undefined),
    };
  });
  if (style === null || editingText) {
    return null;
  }
  const onlyText = !style.hasStroke;

  return (
    <Surface as="aside" className={styles.panel} aria-label="Style">
      <Section title={onlyText ? 'Color' : 'Stroke'}>
        <Swatches
          label={onlyText ? 'Text color' : 'Stroke color'}
          swatches={strokeSwatches}
          theme={theme}
          value={style.strokeColor}
          onChange={(color) => {
            editor.applyStyle({ strokeColor: color });
          }}
        />
      </Section>
      {style.fillColor !== undefined && (
        <Section title="Fill">
          <Swatches
            label="Fill color"
            swatches={fillSwatches}
            theme={theme}
            value={style.fillColor ?? NO_FILL}
            withNone
            onChange={(color) => {
              editor.applyStyle({ fillColor: color === NO_FILL ? null : color });
            }}
          />
        </Section>
      )}
      {style.hasStroke && (
        <Section title="Stroke width">
          <StrokeWidths value={style.strokeWidth} />
        </Section>
      )}
      {style.font !== undefined && (
        <Section title="Font">
          <TextFonts value={style.font} />
        </Section>
      )}
      <Section title="Opacity">
        <Opacity value={style.opacity} />
      </Section>
      <Section title="Layer">
        <div className={styles.row}>
          {(
            [
              ['back', 'Send to back', SendToBack, 'Mod+Shift+['],
              ['backward', 'Send backward', ArrowDown, 'Mod+['],
              ['forward', 'Bring forward', ArrowUp, 'Mod+]'],
              ['front', 'Bring to front', BringToFront, 'Mod+Shift+]'],
            ] as const
          ).map(([action, label, Icon, shortcut]) => (
            <IconButton
              key={action}
              label={label}
              Icon={Icon}
              shortcut={shortcut}
              onClick={backToCanvas(() => {
                editor.perform(action);
              })}
            />
          ))}
          {grouping.canGroup && (
            <IconButton
              label="Group"
              Icon={Group}
              shortcut="Mod+G"
              onClick={backToCanvas(() => {
                editor.perform('group');
              })}
            />
          )}
          {grouping.canUngroup && (
            <IconButton
              label="Ungroup"
              Icon={Ungroup}
              shortcut="Mod+Shift+G"
              onClick={backToCanvas(() => {
                editor.perform('ungroup');
              })}
            />
          )}
        </div>
      </Section>
    </Surface>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </section>
  );
}

type SwatchesProps = {
  readonly label: string;
  readonly swatches: readonly ShapeSwatch[];
  readonly theme: ThemeName;
  /** The stored (light) color, lower case; 'mixed' when the selection differs. */
  readonly value: Shared<string>;
  readonly withNone?: boolean;
  readonly onChange: (color: string) => void;
};

/** Color choices drawn as they appear in this theme; values are the stored colors. */
function Swatches({ label, swatches, theme, value, withNone, onChange }: SwatchesProps) {
  const backToCanvas = useBackToCanvas();
  return (
    <ColorPicker
      label={label}
      options={swatches.map((swatch) => ({
        value: swatch.light.toLowerCase(),
        name: swatch.name,
        display: swatch[theme],
      }))}
      value={value === 'mixed' ? null : value}
      onChange={onChange}
      {...(withNone === true ? { none: { value: NO_FILL, name: 'No fill' } } : {})}
      onItemClick={backToCanvas(() => undefined)}
    />
  );
}

function StrokeWidths({ value }: { readonly value: Shared<number> }) {
  const editor = useEditor();
  const backToCanvas = useBackToCanvas();
  return (
    <SegmentedControl
      label="Stroke width"
      options={WIDTHS.map(({ value: width, label, drawn }) => ({
        value: String(width),
        label,
        content: (
          <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
            <line
              x1="3"
              y1="8"
              x2="17"
              y2="8"
              stroke="currentColor"
              strokeWidth={drawn}
              strokeLinecap="round"
            />
          </svg>
        ),
      }))}
      value={value === 'mixed' ? null : String(value)}
      onChange={(width) => {
        editor.applyStyle({ strokeWidth: Number(width) });
      }}
      onItemClick={backToCanvas(() => undefined)}
    />
  );
}

const FONTS: readonly { value: TextFont; label: string; sample: string }[] = [
  { value: 'hand', label: 'Hand-drawn', sample: styles.hand ?? '' },
  { value: 'sans', label: 'Normal', sample: styles.sans ?? '' },
  { value: 'mono', label: 'Code', sample: styles.mono ?? '' },
];

/** The text face, each option shown in its own face. */
function TextFonts({ value }: { readonly value: Shared<TextFont> }) {
  const editor = useEditor();
  const backToCanvas = useBackToCanvas();
  return (
    <SegmentedControl<TextFont>
      label="Font"
      options={FONTS.map(({ value: font, label, sample }) => ({
        value: font,
        label,
        content: (
          <span className={sample} aria-hidden="true">
            Aa
          </span>
        ),
      }))}
      value={value === 'mixed' ? null : value}
      onChange={(font) => {
        editor.applyTextFont(font);
      }}
      onItemClick={backToCanvas(() => undefined)}
    />
  );
}

/** One drag of the slider is one undo step, however many values it passes through. */
function Opacity({ value }: { readonly value: Shared<number> }) {
  const editor = useEditor();
  const dragging = useRef(false);
  const percent = value === 'mixed' ? null : Math.round(value * 100);
  return (
    <Slider
      label="Opacity"
      min={OPACITY_MIN}
      max={100}
      step={OPACITY_STEP}
      value={percent ?? 100}
      valueText={percent === null ? 'Mixed' : `${String(percent)}%`}
      onChange={(next) => {
        editor.applyStyle({ opacity: next / 100 }, { key: 'opacity', continues: dragging.current });
        dragging.current = true;
      }}
      onCommit={() => {
        dragging.current = false;
      }}
    />
  );
}
