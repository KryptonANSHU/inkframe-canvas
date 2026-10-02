import { Slider as RadixSlider } from 'radix-ui';
import styles from './Slider.module.css';

type SliderProps = {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  /** Every value the thumb passes through while dragging. */
  readonly onChange: (value: number) => void;
  /** Once the drag (or key press) ends, e.g. to close an undo step. */
  readonly onCommit?: () => void;
  /** The value as text, shown after the slider ("80%", "Mixed"). */
  readonly valueText: string;
  readonly disabled?: boolean;
};

/** One value on a track, with its current value shown as text beside it. */
export function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  onCommit,
  valueText,
  disabled = false,
}: SliderProps) {
  return (
    <div className={styles.field}>
      <RadixSlider.Root
        className={styles.slider}
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        aria-label={label}
        onValueChange={([next = value]) => {
          onChange(next);
        }}
        {...(onCommit === undefined ? {} : { onValueCommit: onCommit })}
      >
        <RadixSlider.Track className={styles.track}>
          <RadixSlider.Range className={styles.range} />
        </RadixSlider.Track>
        <RadixSlider.Thumb className={styles.thumb} aria-label={label} />
      </RadixSlider.Root>
      <output className={styles.value}>{valueText}</output>
    </div>
  );
}
