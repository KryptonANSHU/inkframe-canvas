import { X } from 'lucide-react';
import { ICON_STROKE } from '../tokens';
import styles from './Chip.module.css';

type ChipProps = {
  readonly label: string;
  /** Adds a small remove button, named "<removeLabel> <label>" for screen readers. */
  readonly onRemove?: () => void;
  readonly removeLabel?: string;
};

/** A small rounded label, e.g. a granted permission, optionally removable. */
export function Chip({ label, onRemove, removeLabel = 'Remove' }: ChipProps) {
  return (
    <span className={styles.chip}>
      {label}
      {onRemove !== undefined && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`${removeLabel} ${label}`}
          onClick={onRemove}
        >
          <X size={12} strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      )}
    </span>
  );
}
