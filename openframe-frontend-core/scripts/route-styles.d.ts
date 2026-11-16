import type { ReactElement } from 'react';

/**
 * The page's own stylesheet in its HTML, and the complete sheet loading after paint, for an app built with
 * `next-styles build`. Render it once, in the root layout's body. Renders nothing in `next dev` and in any other
 * build.
 */
export function RouteStyles(props?: {
  /**
   * The page's markup depends on the visitor, so no build can sample it: carry the complete sheet. `true` for every
   * page (a signed-in hub), or the path prefixes whose pages do (`['/admin']`: the staff screens of a public site).
   */
  complete?: boolean | readonly string[];
}): ReactElement | null;
