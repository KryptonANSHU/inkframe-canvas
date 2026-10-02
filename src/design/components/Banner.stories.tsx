import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Banner } from './Banner';
import { Button } from './Button';

const meta = {
  title: 'Chrome/Banner',
  component: Banner,
  args: { children: 'The style panel failed. Reload the page to bring it back.' },
  argTypes: { action: { control: false } },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Something stopped working: it says what, and what to do. */
export const Failure: Story = { name: 'Error' };

/** With the one action that works around the problem. */
export const WithAction: Story = {
  args: {
    children:
      "Autosave is off: this browser isn't letting Inkframe store data, so your drawing is kept only until you close this tab.",
    action: (
      <Button variant="primary" size="sm" onClick={fn()}>
        Save a copy
      </Button>
    ),
  },
};
