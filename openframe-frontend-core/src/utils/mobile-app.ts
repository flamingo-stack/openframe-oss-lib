/**
 * Where the OpenFrame apps are installed from. One owner for every surface that
 * offers them: the product's Settings page and the website's download page.
 *
 * Pure and server-safe; also published as the granular subpath
 * `./utils/mobile-app`, for an Edge proxy and other server-only consumers.
 */
import { detectVisitorOs } from './visitor-os';

/** Published listings for the OpenFrame Console mobile app. */
export const APP_STORE_URL = 'https://apps.apple.com/us/app/openframe-console/id6801064262';
export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=ai.openframe.mobile';

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
