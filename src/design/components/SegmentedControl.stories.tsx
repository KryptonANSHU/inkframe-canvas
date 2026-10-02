import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Column } from '../stories/StoryLayout';
import { SegmentedControl } from './SegmentedControl';

/** A short horizontal stroke at the given width, as the style panel draws it. */
function Stroke({ width }: { readonly width: number }) {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
      <line
        x1="3"
        y1="8"
        x2="17"
        y2="8"
        stroke="currentColor"
        strokeWidth={width}
        strokeLinecap="round"
      />
    </svg>
  );
}

const WIDTHS = [
  { value: '1', label: 'Thin', content: <Stroke width={1} /> },
  { value: '2', label: 'Regular', content: <Stroke width={2} /> },
  { value: '4', label: 'Bold', content: <Stroke width={3.5} /> },
  { value: '8', label: 'Heavy', content: <Stroke width={5} /> },
];

const meta = {
  title: 'Inputs/SegmentedControl',
  component: SegmentedControl,
  args: { label: 'Stroke width', options: WIDTHS, value: '2', onChange: fn() },
  argTypes: { options: { control: false } },
  decorators: [
    (Story) => (
      <Column>
        <Story />
      </Column>
    ),
  ],
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <SegmentedControl {...args} value={value} onChange={setValue} />;
  },
};

/** Selected shapes with different widths: no segment lifts. */
export const Mixed: Story = { args: { value: null } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
