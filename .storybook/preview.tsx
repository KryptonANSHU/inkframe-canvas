import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import 'virtual:inkframe-tokens.css';
import '../src/design/global.css';
import './preview.css';
import { TooltipProvider } from '../src/design/components/Tooltip';

type ThemeName = 'light' | 'dark';

/** Themes switch the way the app does: data-theme on <html>. */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals['theme'] as ThemeName;
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);
  return (
    <TooltipProvider>
      <Story />
    </TooltipProvider>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Light or dark theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [withTheme],
  parameters: {
    layout: 'centered',
    // The page background is the canvas color (from the tokens), as in the app.
    backgrounds: { disable: true },
    controls: { expanded: true },
    // Accessibility violations fail the story's checks, not just warn.
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
};

// Storybook requires a default export from its config files.
export default preview;
