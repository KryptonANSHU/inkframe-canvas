import type { Meta, StoryObj } from '@storybook/react-vite';
import { OnTooltip } from '../stories/StoryLayout';
import { Kbd } from './Kbd';

const meta = {
  title: 'Text/Kbd',
  component: Kbd,
  args: { shortcut: 'Mod+Shift+Z', tone: 'plain' },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mod is ⌘ on Apple platforms and Ctrl elsewhere, in each platform's key order. */
export const Plain: Story = {};
export const SingleKey: Story = { args: { shortcut: '?' } };

/** On a tooltip: no caps, just quieter glyphs on the dark background. */
export const Inverse: Story = {
  args: { tone: 'inverse' },
  render: (args) => (
    <OnTooltip>
      Redo <Kbd {...args} />
    </OnTooltip>
  ),
};
