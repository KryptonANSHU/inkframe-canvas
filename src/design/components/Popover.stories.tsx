import type { Meta, StoryObj } from '@storybook/react-vite';
import { Puzzle } from 'lucide-react';
import { expect, userEvent, within } from 'storybook/test';
import { Column } from '../stories/StoryLayout';
import { Button } from './Button';
import { IconTrigger } from './IconButton';
import { Popover } from './Popover';

const meta = {
  title: 'Overlays/Popover',
  component: Popover,
  args: {
    label: 'Plugins',
    align: 'center',
    trigger: <IconTrigger label="Plugins" Icon={Puzzle} />,
    children: (
      <Column>
        Plugins run in a sandbox: they can&apos;t see this page, your files, or the network.
        <Button variant="add">Load plugin from file…</Button>
      </Column>
    ),
  },
  argTypes: { trigger: { control: false }, children: { control: false } },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Plugins' }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('dialog', { name: 'Plugins' })).toBeInTheDocument();
  },
};

export const Closed: Story = {};
