import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ChoiceCard } from './ChoiceCard';

/** A stand-in picture: three connected boxes. */
const PREVIEW = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><g fill="none" stroke="#2275d8" stroke-width="2"><rect x="10" y="35" width="25" height="20"/><rect x="50" y="35" width="25" height="20"/><rect x="90" y="35" width="25" height="20"/><path d="M35 45h15M75 45h15"/></g></svg>',
)}`;

const meta = {
  title: 'Actions/ChoiceCard',
  component: ChoiceCard,
  args: {
    title: 'Web app architecture',
    description: 'Services, data stores, and a job queue',
    preview: PREVIEW,
    onChoose: fn(),
  },
} satisfies Meta<typeof ChoiceCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hover: Story = { parameters: { pseudo: { hover: true } } };
export const Focus: Story = { parameters: { pseudo: { focusVisible: true } } };
