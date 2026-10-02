import type { Meta, StoryObj } from '@storybook/react-vite';
import { Row } from '../stories/StoryLayout';
import { StatusBadge } from './StatusBadge';

const meta = {
  title: 'Text/StatusBadge',
  component: StatusBadge,
  args: { tone: 'ok', label: 'Connected' },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};
export const Reconnecting: Story = { args: { tone: 'busy', label: 'Reconnecting…' } };
export const Offline: Story = { args: { tone: 'off', label: 'Offline' } };

export const All: Story = {
  render: () => (
    <Row>
      <StatusBadge tone="ok" label="Connected" />
      <StatusBadge tone="busy" label="Reconnecting…" />
      <StatusBadge tone="off" label="Offline" />
    </Row>
  ),
};
