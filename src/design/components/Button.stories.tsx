import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, Plus, Trash2 } from 'lucide-react';
import { fn } from 'storybook/test';
import { Row } from '../stories/StoryLayout';
import { Button } from './Button';

const meta = {
  title: 'Actions/Button',
  component: Button,
  args: { children: 'Export', variant: 'secondary', size: 'md', onClick: fn() },
  argTypes: { icon: { control: false } },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: 'primary', children: 'Allow' } };
export const Secondary: Story = {};
export const Ghost: Story = { args: { variant: 'ghost', children: '100%' } };
export const Danger: Story = {
  args: { variant: 'danger', icon: Trash2, children: 'Delete shape' },
};
export const Add: Story = {
  args: { variant: 'add', icon: Plus, children: 'Load plugin from file…' },
};
export const Small: Story = { args: { size: 'sm', children: 'Run' } };
export const WithIcon: Story = { args: { icon: Download } };
export const Disabled: Story = { args: { variant: 'primary', disabled: true } };

/** Every variant at once, in the hover state (forced by the pseudo-states addon). */
export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
  render: (args) => (
    <Row>
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="danger">
        Danger
      </Button>
    </Row>
  ),
};

export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
