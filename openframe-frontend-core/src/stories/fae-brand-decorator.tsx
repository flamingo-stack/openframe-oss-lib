import type { Decorator } from '@storybook/nextjs-vite';
import { useLayoutEffect, type ReactNode } from 'react';

/**
 * Renders a story in the Fae client's default brand. The chat app sets
 * `data-app-type="flamingo"` on <html> before first paint, which points the
 * accent tokens at flamingo pink; without it Storybook falls back to the
 * OpenFrame yellow and a Fae screen shows two brand colours at once. Restores
 * the previous value so the next story is unaffected.
 */
function FaeBrand({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-app-type');
    root.setAttribute('data-app-type', 'flamingo');
    return () => {
      if (previous === null) root.removeAttribute('data-app-type');
      else root.setAttribute('data-app-type', previous);
    };
  }, []);
  return <>{children}</>;
}

export const withFaeBrand: Decorator = Story => (
  <FaeBrand>
    <Story />
  </FaeBrand>
);
