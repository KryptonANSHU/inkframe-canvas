import { ArrowDown, ArrowUp, BringToFront, SendToBack } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Slider, ToggleGroup } from 'radix-ui';
import { selectedShapes } from '../core/selection/selectedShapes';
import { selectionStyle, type Shared } from '../core/style';
import { fillSwatches, strokeSwatches, type ShapeSwatch, type ThemeName } from '../design/tokens';
import { useEditor, useEditorState } from './EditorContext';
import { IconButton } from './IconButton';
import styles from './StylePanel.module.css';
import { Tip } from './Tip';

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
  // Selected separately: each selector returns primitives (or an object of them), so
  // the shallow comparison sees "unchanged" and the panel re-renders only on a change.
  const style = useEditorState((state) => selectionStyle(selectedShapes(state)));
  const theme = useEditorState((state) => state.theme);
  const editingText = useEditorState((state) => state.textEdit !== null);
  if (style === null || editingText) {
    return null;
  }
  const onlyText = !style.hasStroke;

  return (
    <aside className={styles.panel} aria-label="Style">
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
              onClick={() => {
                editor.perform(action);
              }}
            />
          ))}
        </div>
      </Section>
    </aside>
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
  const editor = useEditor();
  return (
    <ToggleGroup.Root
      type="single"
      className={styles.swatches}
      aria-label={label}
      value={value === 'mixed' ? '' : value}
      onValueChange={(color) => {
        if (color !== '') onChange(color);
      }}
    >
      {withNone === true && (
        <Tip label="No fill" side="left">
          <ToggleGroup.Item
            value={NO_FILL}
            className={styles.none}
            aria-label="No fill"
            onClick={(event) => {
              if (event.detail > 0) editor.focus();
            }}
          />
        </Tip>
      )}
      {swatches.map((swatch) => (
        <Tip key={swatch.name} label={swatch.name} side="left">
          <ToggleGroup.Item
            value={swatch.light.toLowerCase()}
            className={styles.swatch}
            aria-label={swatch.name}
            style={{ backgroundColor: swatch[theme] }}
            onClick={(event) => {
              if (event.detail > 0) editor.focus();
            }}
          />
        </Tip>
      ))}
    </ToggleGroup.Root>
  );
}

function StrokeWidths({ value }: { readonly value: Shared<number> }) {
  const editor = useEditor();
  return (
    <ToggleGroup.Root
      type="single"
      className={styles.segments}
      aria-label="Stroke width"
      value={value === 'mixed' ? '' : String(value)}
      onValueChange={(width) => {
        if (width !== '') editor.applyStyle({ strokeWidth: Number(width) });
      }}
    >
      {WIDTHS.map(({ value: width, label, drawn }) => (
        <Tip key={width} label={label} side="bottom">
          <ToggleGroup.Item
            value={String(width)}
            className={styles.segment}
            aria-label={label}
            onClick={(event) => {
              if (event.detail > 0) editor.focus();
            }}
          >
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
          </ToggleGroup.Item>
        </Tip>
      ))}
    </ToggleGroup.Root>
  );
}

/** One drag of the slider is one undo step, however many values it passes through. */
function Opacity({ value }: { readonly value: Shared<number> }) {
  const editor = useEditor();
  const dragging = useRef(false);
  const percent = value === 'mixed' ? null : Math.round(value * 100);
  return (
    <div className={styles.opacity}>
      <Slider.Root
        className={styles.slider}
        min={OPACITY_MIN}
        max={100}
        step={OPACITY_STEP}
        value={[percent ?? 100]}
        aria-label="Opacity"
        onValueChange={([next = 100]) => {
          editor.applyStyle(
            { opacity: next / 100 },
            { key: 'opacity', continues: dragging.current },
          );
          dragging.current = true;
        }}
        onValueCommit={() => {
          dragging.current = false;
        }}
      >
        <Slider.Track className={styles.track}>
          <Slider.Range className={styles.range} />
        </Slider.Track>
        <Slider.Thumb className={styles.thumb} aria-label="Opacity" />
      </Slider.Root>
      <output className={styles.value}>{percent === null ? 'Mixed' : `${String(percent)}%`}</output>
    </div>
  );
}
