/**
 * The link an answer makes to a screen of the app the chat runs in: a markdown link whose TITLE says so,
 * `[Devices → Add Device](/devices/new "app-screen")`. One definition for both sides of the seam: the hub tells the
 * model to write exactly this (`appScreenLinkMarkdown` in its instruction), and the chat draws exactly this as an
 * inline box (`isAppScreenLink`). Nothing is inferred from the path: a link without the title is a plain link.
 *
 * A title, not a new URL scheme, so an answer read by a chat that predates this still shows a working link.
 */

/** The markdown link title that marks a link to a screen of the app. */
export const APP_SCREEN_LINK_TITLE = 'app-screen';

/** The markdown for a link to a screen of the app: the label as the reader sees the screen, the screen's path. */
export function appScreenLinkMarkdown(label: string, path: string): string {
  return `[${label}](${path} "${APP_SCREEN_LINK_TITLE}")`;
}

/**
 * True for a link the answer marked as a screen of the app. The path must also be a path of this app (root-relative,
 * never `//host`): the title states the intent, the path is still checked before the app routes to it.
 */
export function isAppScreenLink(href: string | undefined, title: string | undefined): boolean {
  return title === APP_SCREEN_LINK_TITLE && typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');
}
