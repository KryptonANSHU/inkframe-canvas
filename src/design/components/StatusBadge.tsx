import styles from './StatusBadge.module.css';

type StatusBadgeProps = {
  /** ok: working; busy: trying (connecting, reconnecting); off: not working. */
  readonly tone: 'ok' | 'busy' | 'off';
  readonly label: string;
};

/** A short status with a marker that differs in shape, not just color. Announced politely. */
export function StatusBadge({ tone, label }: StatusBadgeProps) {
  return (
    <span className={styles.badge} role="status">
      <span className={styles.dot} data-tone={tone} aria-hidden="true" />
      {label}
    </span>
  );
}
