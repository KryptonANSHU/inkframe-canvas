import type { Meta, StoryObj } from '@storybook/react-vite';
import { Circle, Lock, LockOpen, MousePointer2, Square, Type } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Toolbar, ToolbarChoice, ToolbarOption, ToolbarSeparator, ToolbarToggle } from './Toolbar';

const meta = {
  title: 'Chrome/Toolbar',
  component: Toolbar,
  args: { label: 'Tools', children: null },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

type Tool = 'select' | 'rectangle' | 'ellipse' | 'text';

function Tools({ label }: { readonly label: string }) {
  const [tool, setTool] = useState<Tool>('select');
  const [locked, setLocked] = useState(false);
  return (
    <Toolbar label={label}>
      <ToolbarChoice<Tool> label="Drawing tool" value={tool} onChange={setTool}>
        <ToolbarOption value="select" label="Select" Icon={MousePointer2} shortcut="V" />
        <ToolbarOption value="rectangle" label="Rectangle" Icon={Square} shortcut="R" />
        <ToolbarOption value="ellipse" label="Ellipse" Icon={Circle} shortcut="O" />
        <ToolbarOption value="text" label="Text" Icon={Type} shortcut="T" />
      </ToolbarChoice>
      <ToolbarSeparator />
      <ToolbarToggle
        label="Keep tool after drawing"
        Icon={locked ? Lock : LockOpen}
        shortcut="Q"
        pressed={locked}
        onClick={() => {
          setLocked(!locked);
        }}
      />
    </Toolbar>
  );
}

/** One Tab stop; arrow keys move between tools, and the chosen one stays chosen. */
export const Default: Story = { render: (args) => <Tools label={args.label} /> };

/** Keyboard: Tab in, arrow right, Space picks the next tool. */
export const Keyboard: Story = {
  render: (args) => <Tools label={args.label} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight} ');
    await expect(canvas.getByRole('radio', { name: 'Rectangle' })).toBeChecked();
  },
};

export const Hover: Story = {
  render: (args) => <Tools label={args.label} />,
  parameters: { pseudo: { hover: true } },
};
