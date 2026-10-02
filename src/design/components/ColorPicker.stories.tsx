import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Column } from '../stories/StoryLayout';
import { fillSwatches, strokeSwatches } from '../tokens';
import { ColorPicker, type ColorOption } from './ColorPicker';

/** Stored as the light color; drawn here in light (stories don't track the theme). */
const toOptions = (swatches: typeof strokeSwatches): ColorOption[] =>
  swatches.map((swatch) => ({
    value: swatch.light.toLowerCase(),
    name: swatch.name,
    display: swatch.light,
  }));

const strokes = toOptions(strokeSwatches);
const fills = toOptions(fillSwatches);

const meta = {
  title: 'Inputs/ColorPicker',
  component: ColorPicker,
  args: {
    label: 'Stroke color',
    options: strokes,
    value: strokes[0]?.value ?? null,
    onChange: fn(),
  },
  argTypes: { options: { control: false } },
  decorators: [
    (Story) => (
      <Column>
        <Story />
      </Column>
    ),
  ],
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Arrow keys move between swatches; Space picks. */
export const Default: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <ColorPicker {...args} value={value} onChange={setValue} />;
  },
};

/** A "no fill" choice first, chosen. */
export const WithNone: Story = {
  args: {
    label: 'Fill color',
    options: fills,
    value: 'none',
    none: { value: 'none', name: 'No fill' },
  },
};

/** Selected shapes in different colors: nothing is marked. */
export const Mixed: Story = { args: { value: null } };
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
