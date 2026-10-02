import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { classes } from './classes';
import styles from './Surface.module.css';

type SurfaceProps = ComponentPropsWithoutRef<'div'> & {
  /** The element: a plain box, a side panel, or a section. */
  readonly as?: 'div' | 'aside' | 'section';
  /** "bar" lays out a row of controls; "panel" is just the floating box. */
  readonly layout?: 'panel' | 'bar';
};

/**
 * Floating chrome over the canvas: surface color, hairline border, one soft shadow.
 * `className` places and lays it out; the look is the Surface's own.
 */
export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { as: Element = 'div', layout = 'panel', className, ...rest },
  ref,
) {
  const own = layout === 'bar' ? styles.bar : styles.surface;
  return <Element ref={ref} className={classes(own, className)} {...rest} />;
});

/** A thin vertical rule between groups of controls in a bar. */
export function Divider() {
  return <span className={styles.divider} aria-hidden="true" />;
}
