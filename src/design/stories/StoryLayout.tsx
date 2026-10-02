import type { ReactNode } from 'react';
import styles from './StoryLayout.module.css';

/** Items side by side, for comparing variants. */
export function Row({ children }: { readonly children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

/** A panel-wide column, for controls that live in the style panel. */
export function Column({ children }: { readonly children: ReactNode }) {
  return <div className={styles.column}>{children}</div>;
}

/** Content on a tooltip's dark background. */
export function OnTooltip({ children }: { readonly children: ReactNode }) {
  return <span className={styles.onTooltip}>{children}</span>;
}
