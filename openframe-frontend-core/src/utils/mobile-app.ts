/**
 * The download page's address, and what a server needs to send a phone on to
 * its store. No link lives here: the store listings, the installer links and
 * the install link the QR code encodes are all the server's (`DownloadsPublic`,
 * read through `useDownloads`).
 *
 * Pure and server-safe; also published as the granular subpath
 * `./utils/mobile-app`, for an Edge proxy and other server-only consumers.
 */
import type { MobileAppLinks } from '../types/downloads';
import { detectVisitorOs } from './visitor-os';

/** The website's download page: every installer and the mobile app. */
export const DOWNLOAD_PAGE_PATH = '/download';

/**
 * The store for a phone or tablet, or `null` for every other system and for a
 * store the server names no listing for (`links` is the server's answer).
 *
 * The server passes the request's User-Agent (the install link's redirect).
 * A browser may also pass `navigator.maxTouchPoints`, the only signal that tells
 * an iPad asking for the desktop site (it calls itself a Macintosh) from a real
 * Mac; the server cannot, so that iPad lands on the download page and its badges.
 */
export function resolveMobileStoreUrl(
  links: MobileAppLinks,
  userAgent: string | null | undefined,
  maxTouchPoints?: number,
): string | null {
  const os = detectVisitorOs(userAgent, { maxTouchPoints });
  if (os === 'ios') return links.appStoreUrl;
  if (os === 'android') return links.googlePlayUrl;
  return null;
}
