import type { Preview } from '@storybook/nextjs-vite';
// Fonts: Next.js apps use next/font/google (fonts.ts), Storybook needs direct CSS import
import '../src/styles/storybook-fonts.css';
import '../src/styles/index.css';


const preview: Preview = {
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