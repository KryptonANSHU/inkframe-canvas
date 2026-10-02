import type { MouseEvent, ReactNode } from 'react';
import { ToggleGroup } from 'radix-ui';
import styles from './SegmentedControl.module.css';
import { Tooltip } from './Tooltip';

type SegmentedControlProps<T extends string> = {
  readonly label: string;
  readonly options: readonly {
    readonly value: T;
    /** The accessible name, also the tooltip. */
    readonly label: string;
    /** What the segment shows, e.g. a small drawing of a line width. */
    readonly content: ReactNode;
  }[];
  /** The chosen value, or null when nothing (or a mix) is chosen. */
  readonly value: T | null;
  readonly onChange: (value: T) => void;
  readonly onItemClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

/** A few mutually exclusive options side by side; the chosen one lifts out. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  onItemClick,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      className={styles.segments}
      aria-label={label}
      value={value ?? ''}
      onValueChange={(next) => {
        if (next !== '') onChange(next as T);
      }}
    >
      {options.map((option) => (
        <Tooltip key={option.value} label={option.label}>
          <ToggleGroup.Item
            value={option.value}
            className={styles.segment}
            aria-label={option.label}
            {...(onItemClick === undefined ? {} : { onClick: onItemClick })}
          >
            {option.content}
          </ToggleGroup.Item>
        </Tooltip>
      ))}
    </ToggleGroup.Root>
  );
}
