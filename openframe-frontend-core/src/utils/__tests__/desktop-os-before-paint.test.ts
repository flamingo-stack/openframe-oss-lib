import { afterEach, describe, expect, it, vi } from 'vitest';
import { desktopOsBeforePaintScript, detectDesktopOs } from '../visitor-os';

const ATTR = 'data-test-desktop-os';

/** Runs the script the way a page does (an inline <script>) under a stubbed navigator, and reads the mark. */
function markFor(userAgent: string, platform?: string, maxTouchPoints = 0): string | null {
  // The script reads the page's own `navigator`, so the stub goes on it (jsdom's inline scripts see this object).
  const nav = window.navigator;
  const ua = vi.spyOn(nav, 'userAgent', 'get').mockReturnValue(userAgent);
  Object.defineProperty(nav, 'maxTouchPoints', { configurable: true, value: maxTouchPoints });
  Object.defineProperty(nav, 'userAgentData', {
    configurable: true,
    value: platform === undefined ? undefined : { platform },
  });
  try {
    const script = document.createElement('script');
    script.textContent = desktopOsBeforePaintScript(ATTR);
    document.body.appendChild(script);
    script.remove();
    return document.documentElement.getAttribute(ATTR);
  } finally {
    ua.mockRestore();
    delete (nav as unknown as Record<string, unknown>).maxTouchPoints;
    delete (nav as unknown as Record<string, unknown>).userAgentData;
  }
}

afterEach(() => document.documentElement.removeAttribute(ATTR));

const CASES: Array<[string, string | undefined, number]> = [
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', undefined, 0],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', undefined, 5],
  ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36', '"Windows"', 0],
  ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36', 'Linux', 0],
  ['Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/130 Safari/537.36', 'Chrome OS', 0],
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36', 'Android', 5],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', undefined, 5],
  ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36', 'macOS', 0],
  ['curl/8.0', undefined, 0],
  ['', undefined, 0],
];

describe('desktopOsBeforePaintScript', () => {
  it.each(CASES)('agrees with detectDesktopOs for %s (hint %s, touch %s)', (ua, platform, touch) => {
    expect(markFor(ua, platform, touch)).toBe(detectDesktopOs(ua, { platform, maxTouchPoints: touch }));
  });
});
