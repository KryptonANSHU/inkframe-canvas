import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Column } from '../stories/StoryLayout';
import { Listbox } from './Listbox';

const meta = {
  title: 'Inputs/Listbox',
  component: Listbox,
  args: {
    label: 'Shapes, top first',
    count: 0,
    activeIndex: 0,
    itemAt: () => ({ id: '', label: '', selected: false }),
    onActiveIndexChange: fn(),
    onSelect: fn(),
  },
  argTypes: { itemAt: { control: false } },
  decorators: [
    (Story) => (
      <Column>
        <Story />
      </Column>
    ),
  ],
} satisfies Meta<typeof Listbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A working list: arrow keys move, Space selects, Shift + Space adds. */
function Shapes({ count }: { readonly count: number }) {
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  return (
    <Listbox
      label="Shapes, top first"
      count={count}
      activeIndex={active}
      onActiveIndexChange={setActive}
      itemAt={(index) => ({
        id: String(index),
        label: `Rectangle ${String(index + 1)}, 120 × 80 at ${String(index * 10)}, 40`,
        selected: selected.has(index),
      })}
      onSelect={(index, additive) => {
        const next = new Set(additive ? selected : []);
        if (additive && next.has(index)) next.delete(index);
        else next.add(index);
        setSelected(next);
      }}
    />
  );
}

export const Default: Story = {
  render: () => <Shapes count={6} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown} {ArrowDown}{Shift>} {/Shift}');
    await expect(canvas.getAllByRole('option', { selected: true })).toHaveLength(2);
  },
};

/** 10,000 options, but only the 50 around the active one exist in the page. */
export const TenThousand: Story = { render: () => <Shapes count={10_000} /> };
