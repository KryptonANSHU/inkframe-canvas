import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Column } from '../stories/StoryLayout';
import { Slider } from './Slider';

const meta = {
  title: 'Inputs/Slider',
  component: Slider,
  args: {
    label: 'Opacity',
    min: 10,
    max: 100,
    step: 5,
    value: 80,
    valueText: '80%',
    onChange: fn(),
    onCommit: fn(),
  },
  decorators: [
    (Story) => (
      <Column>
        <Story />
      </Column>
    ),
  ],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drag, or arrow keys in steps of 5; the value reads out beside the track. */
export const Default: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <Slider {...args} value={value} valueText={`${String(value)}%`} onChange={setValue} />;
  },
};

/** Selected shapes that differ: the thumb rests at the end, the text says so. */
export const Mixed: Story = { args: { value: 100, valueText: 'Mixed' } };
export const Disabled: Story = { args: { disabled: true } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
