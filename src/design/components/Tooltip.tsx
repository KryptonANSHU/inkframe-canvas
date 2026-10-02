import type { ReactElement, ReactNode } from 'react';
import { Tooltip as RadixTooltip } from 'radix-ui';
import { Kbd } from './Kbd';
import styles from './Tooltip.module.css';

/** Tooltips wait a beat before showing, then switch instantly while moving along a bar. */
const DELAY_MS = 400;

/** Wraps the app (or a story) once, so tooltips share their show delay. */
export function TooltipProvider({ children }: { readonly children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={DELAY_MS}>{children}</RadixTooltip.Provider>;
}

type TooltipProps = {
  readonly label: string;
  /** Shown as key caps after the label: "Rectangle  R". */
  readonly shortcut?: string;
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
  /** The control; it must forward refs and props (Radix composes onto it). */
  readonly children: ReactElement;
};

/** A tooltip naming the control and its shortcut. */
export function Tooltip({ label, shortcut, side = 'bottom', children }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className={styles.tooltip} side={side} sideOffset={8}>
          {label}
          {shortcut !== undefined && <Kbd shortcut={shortcut} tone="inverse" />}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
