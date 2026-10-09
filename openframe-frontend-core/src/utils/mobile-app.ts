/**
 * The website's addresses for getting the apps: the download page, the install
 * link that sends a phone on to its store, and the URL the install QR code
 * encodes. The store listings and installer links are NOT here: they are the
 * server's (`DownloadsPublic`, read through `useDownloads`).
 *
 * Pure and server-safe; also published as the granular subpath
 * `./utils/mobile-app`, for an Edge proxy and other server-only consumers.
 */
import type { MobileAppLinks } from '../types/downloads';
import { detectVisitorOs } from './visitor-os';

/** The website's download page: every installer and the mobile app. */
export const DOWNLOAD_PAGE_PATH = '/download';

/**
 * The website's install link. The SERVER answers it by the request's
 * User-Agent: an iPhone or iPad is redirected to the App Store, an Android
 * device to Google Play, and everyone else to the download page. One fixed
 * address, because a QR code holds a single string and whoever scans it is
 * holding the phone the app goes on.
 */
export const MOBILE_APP_INSTALL_PATH = '/mobile';

/**
 * The one URL the install QR code encodes: the website's install link.
 *
 * Absolute and on the production host on purpose: a code must point at
 * production whichever deployment rendered the page it came from. `MobileAppQr`
 * draws this value as committed path data, so the two change together: see the
 * regeneration note on the asset.
 */
export const MOBILE_APP_INSTALL_URL = `https://www.flamingo.run${MOBILE_APP_INSTALL_PATH}`;

/** The install link as it is printed for a human to read or type: no scheme, no `www`. */
export const MOBILE_APP_INSTALL_HOST_PATH = MOBILE_APP_INSTALL_URL.replace(/^https:\/\/(www\.)?/, '');

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
