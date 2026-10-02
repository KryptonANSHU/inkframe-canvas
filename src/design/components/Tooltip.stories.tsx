import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from './Button';
import { Tooltip } from './Tooltip';

const meta = {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  args: {
    label: 'Rectangle',
    shortcut: 'R',
    side: 'bottom',
    children: <Button>Hover or focus me</Button>,
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Shown on keyboard focus as well as hover, so keyboard users get the shortcut too. */
export const WithShortcut: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('tooltip')).toHaveTextContent('Rectangle');
  },
};

export const LabelOnly: Story = {
  render: (args) => (
    <Tooltip label="No fill" side="left">
      {args.children}
    </Tooltip>
  ),
};
