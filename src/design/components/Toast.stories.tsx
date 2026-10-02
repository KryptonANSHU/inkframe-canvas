import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Toast, ToastProvider, ToastViewport } from './Toast';

const meta = {
  title: 'Overlays/Toast',
  component: Toast,
  parameters: { layout: 'fullscreen' },
  args: { tone: 'info', children: 'Canvas cleared. Press Ctrl+Z to undo.', onClose: fn() },
  argTypes: { children: { control: 'text' } },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
        <ToastViewport />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

/** Announced assertively; says what happened and how to fix it. */
export const Failure: Story = {
  name: 'Error',
  args: {
    tone: 'error',
    children: "This file isn't a valid Inkframe file. Export a new one and try again.",
  },
};

/** Stays up while the work runs; nothing to dismiss. */
export const Progress: Story = {
  args: { tone: 'progress', children: 'Opening drawing.json · 40%' },
};
