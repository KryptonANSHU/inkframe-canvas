import type { Meta, StoryObj } from '@storybook/react-vite';
import { Eraser, FolderOpen, Menu as MenuIcon, Monitor, Moon, Save, Sun } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { IconTrigger } from './IconButton';
import { Menu, MenuItem, MenuRadioGroup, MenuSeparator } from './Menu';

const meta = {
  title: 'Overlays/Menu',
  component: Menu,
  args: { trigger: <IconTrigger label="Menu" Icon={MenuIcon} />, children: null },
  argTypes: { trigger: { control: false }, children: { control: false } },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

type Theme = 'system' | 'light' | 'dark';
const THEMES = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

function FileMenu({ trigger }: { readonly trigger: ReactElement }) {
  const [theme, setTheme] = useState<Theme>('system');
  return (
    <Menu trigger={trigger}>
      <MenuItem icon={FolderOpen} label="Open…" shortcut="Mod+O" onSelect={fn()} />
      <MenuItem icon={Save} label="Save as JSON" shortcut="Mod+S" onSelect={fn()} />
      <MenuSeparator />
      <MenuItem icon={Eraser} label="Clear canvas" danger onSelect={fn()} />
      <MenuItem
        icon={Eraser}
        label="Clear canvas (nothing to clear)"
        danger
        disabled
        onSelect={fn()}
      />
      <MenuSeparator />
      <MenuRadioGroup<Theme> label="Theme" value={theme} options={THEMES} onChange={setTheme} />
    </Menu>
  );
}

/** Items with icons and shortcuts, a destructive item (and its disabled state), a radio group. */
export const Open: Story = {
  render: (args) => <FileMenu trigger={args.trigger} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Menu' }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('menu')).toBeInTheDocument();
  },
};

export const Closed: Story = { render: (args) => <FileMenu trigger={args.trigger} /> };
