/**
 * Walkthrough-video deep link — the ONE home for the query param that opens
 * the floating walkthrough widget's theater full-screen (paused) on page
 * load. Consumed by the widget itself (`FloatingWalkthroughVideo` defaults
 * its `deepLinkParam` prop to this) and by hosts that MINT deep-link URLs
 * (invitation emails) or carry the param across redirects (the hub's
 * auth-wall proxy). Lives beside `dismissal-storage.ts` — the same
 * widget-adjacent naming-layer altitude.
 */

/** `?walkthrough=1` — presence-based on the read side (any value counts);
 *  `=1` is just the canonical value URL minters write. */
export const WALKTHROUGH_OPEN_QUERY_PARAM = 'walkthrough';

/** Append the theater deep-link param to a URL (absolute or relative). */
export function withWalkthroughOpenParam(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${WALKTHROUGH_OPEN_QUERY_PARAM}=1`;
}
