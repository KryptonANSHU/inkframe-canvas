import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Kbd } from './Kbd';

const meta = {
  title: 'Overlays/Dialog',
  component: Dialog,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Allow “Grid of shapes” to run?',
    description: 'Version 1.0.0 · built in',
    width: 'narrow',
    closable: false,
    children: 'It asks to see the shapes you select and add shapes to your drawing.',
    actions: (
      <>
        <Button>Don&apos;t allow</Button>
        <Button variant="primary">Allow</Button>
      </>
    ),
  },
  argTypes: { actions: { control: false }, children: { control: false } },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A decision: no close button, the actions are the ways out (Escape declines). */
export const Confirm: Story = {};

/** Reference content: wide, with a close button and no actions. */
export const Wide: Story = {
  args: {
    title: 'Keyboard shortcuts',
    description: 'Shortcuts work while the canvas or the toolbar has focus.',
    width: 'wide',
    closable: true,
    actions: undefined,
    children: (
      <p>
        Undo <Kbd shortcut="Mod+Z" /> · Redo <Kbd shortcut="Mod+Shift+Z" />
      </p>
    ),
  },
};
