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
    // Only these three viewports (plus the built-in "Reset viewport"); widths
    // match the ODS auth breakpoints. Default is reset (unconstrained).
    viewport: {
      options: {
        mobile: { name: 'Mobile', styles: { width: '430px', height: '932px' } },
        tablet: { name: 'Tablet', styles: { width: '800px', height: '1180px' } },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '900px' } },
      },
    },
  },
  initialGlobals: {
    viewport: { value: undefined, isRotated: false },
  },
};

export default preview;