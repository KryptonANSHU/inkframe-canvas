import type { MouseEvent } from 'react';
import { ToggleGroup } from 'radix-ui';
import styles from './ColorPicker.module.css';
import { Tooltip } from './Tooltip';

/** One choice: the stored value, its name, and the color to draw it in right now. */
export type ColorOption = {
  readonly value: string;
  readonly name: string;
  /** Any CSS color; differs from `value` when a theme draws stored colors differently. */
  readonly display: string;
};

type ColorPickerProps = {
  readonly label: string;
  readonly options: readonly ColorOption[];
  /** The chosen value, or null when nothing (or a mix) is chosen. */
  readonly value: string | null;
  readonly onChange: (value: string) => void;
  /** Adds a "none" choice first, with this value and name. */
  readonly none?: { readonly value: string; readonly name: string };
  /** Each swatch's click, e.g. to hand focus back after a pointer pick. */
  readonly onItemClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * A row of color swatches, one choosable (arrow keys move, Space picks). Each swatch is
 * named for screen readers and in its tooltip.
 */
export function ColorPicker({
  label,
  options,
  value,
  onChange,
  none,
  onItemClick,
}: ColorPickerProps) {
  const click = onItemClick === undefined ? {} : { onClick: onItemClick };
  return (
    <ToggleGroup.Root
      type="single"
      className={styles.swatches}
      aria-label={label}
      value={value ?? ''}
      onValueChange={(next) => {
        // Radix sends "" when the chosen swatch is clicked again; it stays chosen.
        if (next !== '') onChange(next);
      }}
    >
      {none !== undefined && (
        <Tooltip label={none.name} side="left">
          <ToggleGroup.Item
            value={none.value}
            className={styles.none}
            aria-label={none.name}
            {...click}
          />
        </Tooltip>
      )}
      {options.map((option) => (
        <Tooltip key={option.value} label={option.name} side="left">
          <ToggleGroup.Item
            value={option.value}
            className={styles.swatch}
            aria-label={option.name}
            style={{ backgroundColor: option.display }}
            {...click}
          />
        </Tooltip>
      ))}
    </ToggleGroup.Root>
  );
}
