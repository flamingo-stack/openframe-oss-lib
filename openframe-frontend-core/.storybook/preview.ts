import type { Preview } from '@storybook/nextjs-vite';
// Fonts: Next.js apps use next/font/google (fonts.ts), Storybook needs direct CSS import
import '../src/styles/storybook-fonts.css';
import '../src/styles/index.css';


const preview: Preview = {
  // Toolbar toggle to flip ODS tokens via `data-theme` on <html> (dark is the
  // default `:root`; light is `[data-theme="light"]`).
  globalTypes: {
    theme: {
      description: 'ODS theme',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'dark', title: 'Dark', icon: 'circle' },
          { value: 'light', title: 'Light', icon: 'circlehollow' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'light' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
      return Story();
    },
  ],
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;