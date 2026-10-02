import type { ReactNode } from 'react';
import { classes } from './classes';
import styles from './Banner.module.css';

type BannerProps = {
  readonly children: ReactNode;
  /** One button that fixes or works around the problem. */
  readonly action?: ReactNode;
  /** Places the banner. */
  readonly className?: string | undefined;
};

/** A persistent problem notice, announced as an alert. */
export function Banner({ children, action, className }: BannerProps) {
  return (
    <div
      className={classes(styles.banner, className)}
      role="alert"
      data-has-action={action !== undefined}
    >
      <span>{children}</span>
      {action}
    </div>
  );
}
