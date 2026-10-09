import { describe, expect, it } from 'vitest';
import {
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
  MOBILE_APP_INSTALL_HOST_PATH,
  MOBILE_APP_INSTALL_URL,
  resolveMobileStoreUrl,
} from '../mobile-app';

/**
 * The install URL cannot change: it is printed into a QR code that also exists
 * on paper, and that code is committed as path data in `MobileAppQr`. If this
 * fails, REGENERATE THE QR; do not update the expectation.
 */
describe('MOBILE_APP_INSTALL_URL', () => {
  it('is exactly what the committed QR path data encodes', () => {
    expect(MOBILE_APP_INSTALL_URL).toBe('https://openframe.ai/mobile');
  });

  it('prints without its scheme', () => {
    expect(MOBILE_APP_INSTALL_HOST_PATH).toBe('openframe.ai/mobile');
  });
});

describe('resolveMobileStoreUrl', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

  it('sends iOS devices to the App Store and Android to Play', () => {
    expect(resolveMobileStoreUrl(IPHONE, 5)).toBe(APP_STORE_URL);
    expect(resolveMobileStoreUrl(ANDROID, 5)).toBe(GOOGLE_PLAY_URL);
  });

  it('reads an iPad asking for the desktop site as iOS, by its touch points', () => {
    expect(resolveMobileStoreUrl(MAC, 5)).toBe(APP_STORE_URL);
  });

  it('keeps desktops, and a server with no touch signal, on the page', () => {
    expect(resolveMobileStoreUrl(MAC, 0)).toBeNull();
    expect(resolveMobileStoreUrl(MAC)).toBeNull();
    expect(resolveMobileStoreUrl(WINDOWS, 0)).toBeNull();
    expect(resolveMobileStoreUrl(null)).toBeNull();
  });
});
