import { describe, expect, it } from 'vitest';
import { desktopOsOf, detectDesktopOs, detectVisitorOs, shortcutLabel } from '../visitor-os';

const UA = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36',
};

describe('visitor system detection', () => {
  it('names each system, phones before the desktop words their User-Agent also carries', () => {
    expect(detectVisitorOs(UA.mac)).toBe('mac');
    expect(detectVisitorOs(UA.windows)).toBe('windows');
    expect(detectVisitorOs(UA.linux)).toBe('linux');
    expect(detectVisitorOs(UA.iphone)).toBe('ios');
    expect(detectVisitorOs(UA.android)).toBe('android');
    expect(detectVisitorOs('')).toBeNull();
    expect(detectVisitorOs(null)).toBeNull();
    expect(detectVisitorOs('curl/8.4.0')).toBeNull();
  });

  it('reads an iPad that calls itself a Macintosh as iOS once the browser reports touch points', () => {
    expect(detectVisitorOs(UA.mac, { maxTouchPoints: 5 })).toBe('ios');
    expect(detectVisitorOs(UA.mac, { maxTouchPoints: 0 })).toBe('mac');
    expect(detectVisitorOs(UA.windows, { maxTouchPoints: 10 })).toBe('windows');
  });

  it('reads the Client Hints platform first, quoted as the header sends it, and falls back to the User-Agent', () => {
    expect(detectVisitorOs(UA.mac, { platform: '"Windows"' })).toBe('windows');
    expect(detectVisitorOs(null, { platform: 'macOS' })).toBe('mac');
    expect(detectVisitorOs(UA.linux, { platform: 'Android' })).toBe('android');
    expect(detectVisitorOs(null, { platform: 'Chrome OS' })).toBe('linux');
    // An empty or unknown hint is no hint.
    expect(detectVisitorOs(UA.windows, { platform: '' })).toBe('windows');
    expect(detectVisitorOs(UA.windows, { platform: '"Unknown"' })).toBe('windows');
    expect(detectVisitorOs(null, { platform: 'macOS', maxTouchPoints: 5 })).toBe('ios');
  });

  it('offers an installer to desktop systems only', () => {
    expect(detectDesktopOs(UA.windows)).toBe('windows');
    expect(detectDesktopOs(UA.iphone)).toBeNull();
    expect(desktopOsOf('android')).toBeNull();
    expect(desktopOsOf(null)).toBeNull();
  });

  it('words a shortcut for the system', () => {
    expect(shortcutLabel('mac', 'K')).toBe('⌘K');
    expect(shortcutLabel('ios', 'K')).toBe('⌘K');
    expect(shortcutLabel('windows', 'K')).toBe('Ctrl K');
    expect(shortcutLabel('linux', 'K')).toBe('Ctrl K');
    expect(shortcutLabel(null, 'K')).toBe('Ctrl K');
  });
});
