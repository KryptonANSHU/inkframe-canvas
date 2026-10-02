import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import styles from './Listbox.module.css';
import { listWindow, LIST_WINDOW } from './listWindow';

/** What the listbox needs to draw one option. */
export type ListboxItem = {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
};

type ListboxProps = {
  readonly label: string;
  readonly count: number;
  /** Only called for the options in view, so long lists cost no more than short ones. */
  readonly itemAt: (index: number) => ListboxItem;
  readonly activeIndex: number;
  readonly onActiveIndexChange: (index: number) => void;
  /** Space, Enter, or a click; `additive` with Shift (adds to the selection). */
  readonly onSelect: (index: number, additive: boolean) => void;
  readonly onEscape?: () => void;
  readonly windowSize?: number;
};

/** Keys that move the active option, and by how much (Infinity: to an end). */
const MOVES: Readonly<Record<string, number>> = {
  ArrowDown: 1,
  ArrowUp: -1,
  PageDown: 10,
  PageUp: -10,
  Home: -Infinity,
  End: Infinity,
};

/**
 * A multi-select listbox. Focus stays on the list and `aria-activedescendant` names the
 * active option, so only the options around it need to exist (`aria-setsize` and
 * `aria-posinset` tell screen readers the full length). Radix has no listbox; this
 * follows the WAI-ARIA listbox pattern.
 */
export function Listbox({
  label,
  count,
  itemAt,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onEscape,
  windowSize = LIST_WINDOW,
}: ListboxProps) {
  const prefix = useId();
  const list = useRef<HTMLUListElement>(null);
  const active = Math.min(Math.max(activeIndex, 0), Math.max(count - 1, 0));
  const { start, end } = listWindow(count, active, windowSize);
  const optionId = (index: number) => `${prefix}-option-${String(index)}`;

  useEffect(() => {
    list.current?.querySelector(`[data-active='true']`)?.scrollIntoView({ block: 'nearest' });
  }, [active, start]);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const move = MOVES[event.key];
    if (move !== undefined) {
      event.preventDefault();
      onActiveIndexChange(Math.min(Math.max(active + move, 0), count - 1));
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (count > 0) onSelect(active, event.shiftKey);
    } else if (event.key === 'Escape' && onEscape !== undefined) {
      event.preventDefault();
      onEscape();
    }
  };

  const options = [];
  for (let index = start; index < end; index++) {
    const item = itemAt(index);
    options.push(
      // Pointer selection only: keyboard users select from the listbox, which has focus.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
      <li
        key={item.id}
        id={optionId(index)}
        role="option"
        aria-selected={item.selected}
        aria-setsize={count}
        aria-posinset={index + 1}
        className={styles.option}
        data-active={index === active}
        onClick={(event) => {
          onActiveIndexChange(index);
          onSelect(index, event.shiftKey);
        }}
      >
        <span className={styles.label}>{item.label}</span>
      </li>,
    );
  }

  return (
    <ul
      ref={list}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-multiselectable="true"
      {...(count > 0 ? { 'aria-activedescendant': optionId(active) } : {})}
      className={styles.listbox}
      onKeyDown={onKeyDown}
    >
      {options}
    </ul>
  );
}
