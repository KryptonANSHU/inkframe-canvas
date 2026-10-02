import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Row } from '../stories/StoryLayout';
import { Chip } from './Chip';

const meta = {
  title: 'Inputs/Chip',
  component: Chip,
  args: { label: 'Add shapes' },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {};

/** A granted permission the user can revoke; the button is named "Revoke Add shapes". */
export const Removable: Story = { args: { onRemove: fn(), removeLabel: 'Revoke' } };

export const Several: Story = {
  render: () => (
    <Row>
      <Chip label="Read selection" onRemove={fn()} removeLabel="Revoke" />
      <Chip label="Change shapes" onRemove={fn()} removeLabel="Revoke" />
      <Chip label="Messages" onRemove={fn()} removeLabel="Revoke" />
    </Row>
  ),
};

export const Hover: Story = { args: { onRemove: fn() }, parameters: { pseudo: { hover: true } } };
