import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleQuestionMark, Redo2, Undo2 } from 'lucide-react';
import { fn } from 'storybook/test';
import { IconButton } from './IconButton';
import { Divider, Surface } from './Surface';

const meta = {
  title: 'Chrome/Surface',
  component: Surface,
  args: { layout: 'panel', as: 'div' },
} satisfies Meta<typeof Surface>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Floating chrome: surface color, hairline border, one soft shadow. */
export const Panel: Story = {
  args: { children: 'Floating panel content', 'aria-label': 'Panel' },
};

/** A bar of controls with a divider between groups, like the undo / redo bar. */
export const Bar: Story = {
  args: { layout: 'bar', role: 'group', 'aria-label': 'History' },
  render: (args) => (
    <Surface {...args}>
      <IconButton label="Undo" Icon={Undo2} shortcut="Mod+Z" onClick={fn()} />
      <IconButton label="Redo" Icon={Redo2} shortcut="Mod+Shift+Z" onClick={fn()} disabled />
      <Divider />
      <IconButton
        label="Keyboard shortcuts"
        Icon={CircleQuestionMark}
        shortcut="?"
        onClick={fn()}
      />
    </Surface>
  ),
};
