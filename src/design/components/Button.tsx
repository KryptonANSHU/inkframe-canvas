import type { LucideIcon } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { ICON_STROKE, size as sizes } from '../tokens';
import styles from './Button.module.css';
import { classes } from './classes';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'add';

type ButtonProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'> & {
  /** primary: the main action; danger: destructive; add: adds something (dashed). */
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'sm';
  /** A leading icon, decorative: the label names the action. */
  readonly icon?: LucideIcon;
  readonly type?: 'button' | 'submit';
};

/** A text button. Its label says exactly what happens ("Export", not "OK"). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, type = 'button', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      // A literal per value: eslint's react/button-has-type can see it.
      type={type === 'submit' ? 'submit' : 'button'}
      className={classes(styles[variant], className)}
      data-size={size}
      {...rest}
    >
      {Icon !== undefined && <Icon size={sizes.icon} strokeWidth={ICON_STROKE} aria-hidden />}
      {children}
    </button>
  );
});
