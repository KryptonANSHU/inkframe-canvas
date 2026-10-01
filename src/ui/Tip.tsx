import type { ReactElement } from 'react';
import { Tooltip } from 'radix-ui';
import { Kbd } from './Kbd';
import surfaces from './surfaces.module.css';

type TipProps = {
  readonly label: string;
  readonly shortcut?: string;
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
  /** The control; it must forward refs and props (Radix composes onto it). */
  readonly children: ReactElement;
};

/** A tooltip naming the control and its shortcut, e.g. "Rectangle  R". */
export function Tip({ label, shortcut, side = 'bottom', children }: TipProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={surfaces.tooltip} side={side} sideOffset={8}>
          {label}
          {shortcut !== undefined && <Kbd shortcut={shortcut} tone="inverse" />}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
