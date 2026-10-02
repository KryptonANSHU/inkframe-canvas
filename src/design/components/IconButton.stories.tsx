import type { Meta, StoryObj } from '@storybook/react-vite';
import { Grid3x3, Menu, Redo2, Undo2 } from 'lucide-react';
import { fn } from 'storybook/test';
import { IconButton, IconTrigger } from './IconButton';
import { Surface } from './Surface';

const meta = {
  title: 'Actions/IconButton',
  component: IconButton,
  args: { label: 'Undo', Icon: Undo2, shortcut: 'Mod+Z', onClick: fn() },
  argTypes: { Icon: { control: false } },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** A toggle that is on: the selected look, announced as pressed. */
export const Pressed: Story = {
  args: { label: 'Grid', Icon: Grid3x3, shortcut: "Mod+'", pressed: true },
};
export const Disabled: Story = { args: { label: 'Redo', Icon: Redo2, disabled: true } };
export const Small: Story = { args: { size: 'sm' } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };

/** The button that opens a menu or popover: no tooltip, the panel explains itself. */
export const Trigger: Story = {
  render: () => (
    <Surface layout="bar">
      <IconTrigger label="Menu" Icon={Menu} />
    </Surface>
  ),
};
