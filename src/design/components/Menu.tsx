import type { LucideIcon } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { DropdownMenu } from 'radix-ui';
import { ICON_STROKE, size } from '../tokens';
import styles from './Menu.module.css';
import { shortcutText } from './shortcuts';

type MenuProps = {
  /** The button that opens the menu; it must forward refs and props. */
  readonly trigger: ReactElement;
  readonly side?: 'top' | 'bottom';
  readonly align?: 'start' | 'end';
  /** Where focus goes on close; call event.preventDefault() to move it yourself. */
  readonly onCloseAutoFocus?: (event: Event) => void;
  readonly children: ReactNode;
};

/**
 * A dropdown menu. Non-modal: a menu button needs no focus trap, and nothing else on
 * the page is hidden from screen readers while it is open.
 */
export function Menu({
  trigger,
  side = 'bottom',
  align = 'start',
  onCloseAutoFocus,
  children,
}: MenuProps) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menu}
          side={side}
          align={align}
          sideOffset={8}
          {...(onCloseAutoFocus === undefined ? {} : { onCloseAutoFocus })}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type MenuItemProps = {
  readonly label: string;
  readonly onSelect: () => void;
  readonly icon?: LucideIcon;
  readonly shortcut?: string;
  /** Destructive: shown in the danger color. */
  readonly danger?: boolean;
  readonly disabled?: boolean;
};

export function MenuItem({
  label,
  onSelect,
  icon: Icon,
  shortcut,
  danger,
  disabled,
}: MenuItemProps) {
  return (
    <DropdownMenu.Item
      className={danger === true ? styles.danger : styles.item}
      onSelect={onSelect}
      disabled={disabled === true}
    >
      {Icon !== undefined && (
        <Icon className={styles.icon} size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
      )}
      {label}
      {shortcut !== undefined && <span className={styles.shortcut}>{shortcutText(shortcut)}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className={styles.separator} />;
}

type MenuRadioGroupProps<T extends string> = {
  /** Shown above the options, e.g. "Theme". */
  readonly label: string;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly {
    readonly value: T;
    readonly label: string;
    readonly icon?: LucideIcon;
  }[];
};

/** Pick one of a few options inside a menu; the chosen one shows a dot. */
export function MenuRadioGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: MenuRadioGroupProps<T>) {
  return (
    <>
      <DropdownMenu.Label className={styles.label}>{label}</DropdownMenu.Label>
      <DropdownMenu.RadioGroup
        value={value}
        onValueChange={(next) => {
          onChange(next as T);
        }}
      >
        {options.map(({ value: option, label: text, icon: Icon }) => (
          <DropdownMenu.RadioItem key={option} value={option} className={styles.item}>
            {Icon !== undefined && (
              <Icon
                className={styles.icon}
                size={size.icon}
                strokeWidth={ICON_STROKE}
                aria-hidden
              />
            )}
            {text}
            <DropdownMenu.ItemIndicator className={styles.check} />
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
    </>
  );
}
