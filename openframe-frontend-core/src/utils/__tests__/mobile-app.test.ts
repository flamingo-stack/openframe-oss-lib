import { describe, expect, it } from 'vitest';
import { printableUrl, resolveMobileStoreUrl } from '../mobile-app';

describe('printableUrl', () => {
  it('prints an address without scheme, www, query or trailing slash', () => {
    expect(printableUrl('https://www.example.com/mobile')).toBe('example.com/mobile');
    expect(printableUrl('http://example.com/mobile/?from=qr#top')).toBe('example.com/mobile');
  });
});

const APP_STORE_URL = 'https://apps.test/app';
const GOOGLE_PLAY_URL = 'https://play.test/app';
const LINKS = { appStoreUrl: APP_STORE_URL, googlePlayUrl: GOOGLE_PLAY_URL };

describe('resolveMobileStoreUrl', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

  it('sends iOS devices to the App Store and Android to Play', () => {
    expect(resolveMobileStoreUrl(LINKS, IPHONE, 5)).toBe(APP_STORE_URL);
    expect(resolveMobileStoreUrl(LINKS, ANDROID, 5)).toBe(GOOGLE_PLAY_URL);
  });

  it('reads an iPad asking for the desktop site as iOS, by its touch points', () => {
    expect(resolveMobileStoreUrl(LINKS, MAC, 5)).toBe(APP_STORE_URL);
  });

  it('keeps desktops, and a server with no touch signal, on the page', () => {
    expect(resolveMobileStoreUrl(LINKS, MAC, 0)).toBeNull();
    expect(resolveMobileStoreUrl(LINKS, MAC)).toBeNull();
    expect(resolveMobileStoreUrl(LINKS, WINDOWS, 0)).toBeNull();
    expect(resolveMobileStoreUrl(LINKS, null)).toBeNull();
  });

  it('sends nobody to a store the server names no listing for', () => {
    expect(resolveMobileStoreUrl({ appStoreUrl: null, googlePlayUrl: GOOGLE_PLAY_URL }, IPHONE, 5)).toBeNull();
    expect(resolveMobileStoreUrl({ appStoreUrl: APP_STORE_URL, googlePlayUrl: null }, ANDROID, 5)).toBeNull();
  });
});
