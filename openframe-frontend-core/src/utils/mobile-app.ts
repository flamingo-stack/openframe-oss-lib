/**
 * The download page's own addresses: where it lives, the parameter that sends a
 * phone on to its store, and the URL the install QR code encodes. The store
 * listings and installer links are NOT here: they are the server's
 * (`DownloadsPublic`, read through `useDownloads`).
 *
 * Pure and server-safe; also published as the granular subpath
 * `./utils/mobile-app`, for an Edge proxy and other server-only consumers.
 */
import type { MobileAppLinks } from '../types/downloads';
import { detectVisitorOs } from './visitor-os';

/** The website's download page: every installer and the mobile app. */
export const DOWNLOAD_PAGE_PATH = '/download';

/**
 * On the download page: "send a phone or a tablet on to its store". The install
 * QR code carries it, because whoever scans a code is holding the phone the app
 * goes on. Anyone who opens the page without it reads the page.
 */
export const DOWNLOAD_PAGE_STORE_PARAM = 'store';

/**
 * The one URL the install QR code encodes: the website's download page, asking
 * it to send a phone on to its store.
 *
 * Absolute and on the production host on purpose: a code must point at
 * production whichever deployment rendered the page it came from. `MobileAppQr`
 * draws this value as committed path data, so the two change together: see the
 * regeneration note on that component.
 */
export const MOBILE_APP_INSTALL_URL = `https://www.flamingo.run${DOWNLOAD_PAGE_PATH}?${DOWNLOAD_PAGE_STORE_PARAM}=1`;

/** The download page as it is printed for a human to read or type: no scheme, no `www`, no query. */
export const MOBILE_APP_INSTALL_HOST_PATH = MOBILE_APP_INSTALL_URL.replace(/^https:\/\/(www\.)?/, '').replace(
  /\?.*$/,
  '',
);

/**
 * The store for a phone or tablet, or `null` for every other system and for a
 * store the server names no listing for (`links` is the server's answer).
 *
 * The server passes the request's User-Agent; a browser also passes
 * `navigator.maxTouchPoints`, the only signal that tells an iPad asking for the
 * desktop site (it calls itself a Macintosh) from a real Mac.
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
