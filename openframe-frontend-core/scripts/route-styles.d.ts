import type { ReactElement } from 'react';

/**
 * The page's own stylesheet in its HTML, and the complete sheet loading after paint, for an app built with
 * `next-styles build`. Render it once, in the root layout's body. Renders nothing in `next dev` and in any other
 * build.
 */
export function RouteStyles(props?: {
  /** The page's markup depends on the visitor (a signed-in hub): carry the complete sheet. */
  complete?: boolean;
}): ReactElement | null;
