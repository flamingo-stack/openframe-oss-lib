/**
 * Where the OpenFrame Console mobile app is installed from. One owner for every
 * surface that offers it: the product's Settings page and the website's
 * download page.
 *
 * Pure and server-safe; also published as the granular subpath
 * `./utils/mobile-app`, for an Edge proxy and other server-only consumers.
 */
import { detectVisitorOs } from './visitor-os';

/** Published listings for the OpenFrame Console mobile app. */
export const APP_STORE_URL = 'https://apps.apple.com/us/app/openframe-console/id6801064262';
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=ai.openframe.mobile';

/** The path the install QR code lands on, on the product's apex host. */
export const MOBILE_APP_INSTALL_PATH = '/mobile';

/**
 * The one URL the install QR code encodes, and the only one printed anywhere.
 *
 * A QR code carries a single fixed string, so the per-system choice happens at
 * whatever answers this URL: a phone is sent to its store, everything else to
 * the download page.
 *
 * Absolute and on the production apex host on purpose: a printed code must
 * point at production whichever deployment rendered the page it came from.
 * Once printed it cannot be changed. `MobileAppQr` draws this value inline;
 * regenerate its path data if this ever changes.
 */
export const MOBILE_APP_INSTALL_URL = `https://openframe.ai${MOBILE_APP_INSTALL_PATH}`;

/** {@link MOBILE_APP_INSTALL_URL} as it is printed for a human to read or type. */
export const MOBILE_APP_INSTALL_HOST_PATH = MOBILE_APP_INSTALL_URL.replace(/^https:\/\//, '');

/**
 * The store for a phone or tablet, or `null` for every other system.
 *
 * The server passes the request's User-Agent; a browser also passes
 * `navigator.maxTouchPoints`, the only signal that tells an iPad asking for the
 * desktop site (it calls itself a Macintosh) from a real Mac.
 */
export function resolveMobileStoreUrl(userAgent: string | null | undefined, maxTouchPoints?: number): string | null {
  const os = detectVisitorOs(userAgent, { maxTouchPoints });
  if (os === 'ios') return APP_STORE_URL;
  if (os === 'android') return GOOGLE_PLAY_URL;
  return null;
}

/**
 * The website's download page: every installer and the mobile app. It is where
 * {@link MOBILE_APP_INSTALL_URL} sends everyone who is not on a phone.
 */
export const DOWNLOAD_PAGE_PATH = '/download';

/**
 * On the download page: "send a phone or a tablet on to its store". The install
 * address redirects there with it, so the one case a server cannot classify (an
 * iPad asking for the desktop site) still reaches the App Store.
 */
export const DOWNLOAD_PAGE_STORE_PARAM = 'store';
