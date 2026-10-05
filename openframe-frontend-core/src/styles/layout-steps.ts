/**
 * Layout steps in px, the one place they are written. `viewport` is the window
 * step (`md:`, `useMdUp`), `content` its content-area counterpart
 * (`content-md:`, `useContentMdUp`): the viewport step less the navigation.
 *
 * Imported by tailwind.config.ts, so it must stay free of imports and aliases.
 */
export const LAYOUT_STEPS = {
  sm: { viewport: 640, content: 640 },
  md: { viewport: 800, content: 720 },
  lg: { viewport: 1280, content: 1024 },
  xl: { viewport: 1440, content: 1216 },
  '2xl': { viewport: 1536, content: 1312 },
} as const;
