/**
 * THE detection of the system a visitor is on. One rule, read by everything
 * that depends on it: which installer the desktop app's download offers, and
 * which shortcut key a hint shows. Never test `navigator.platform` or a
 * User-Agent anywhere else.
 *
 * Pure and server-safe: the server passes the request's User-Agent, the browser
 * goes through `useVisitorOs` (hooks), which also passes the touch-point count.
 */
export type VisitorOs = 'mac' | 'windows' | 'linux' | 'ios' | 'android';

/** The systems the desktop app installs on. */
export const DESKTOP_OSES = ['mac', 'windows', 'linux'] as const;
export type DesktopOs = (typeof DESKTOP_OSES)[number];

export interface VisitorOsHints {
  /**
   * The platform the browser STATES through User-Agent Client Hints:
   * `navigator.userAgentData.platform` in the browser, the `Sec-CH-UA-Platform`
   * request header on the server (Chromium browsers send it on every request).
   * It is the current standard and is read first: browsers are freezing the
   * User-Agent string, so the hint is the value they keep accurate. Safari and
   * Firefox send none, which is why the User-Agent stays the fallback.
   */
  platform?: string | null;
  /**
   * `navigator.maxTouchPoints`, when the caller is a browser. An iPad asks for
   * the desktop site by default and then calls itself a Macintosh; a Macintosh
   * with a touch screen does not exist, so touch points tell the two apart. The
   * server has no such signal and reads that iPad as a Mac.
   */
  maxTouchPoints?: number;
}

/** Client Hints platform names (the header quotes them) to ours. Chrome OS runs Linux apps. */
const HINT_PLATFORMS: Record<string, VisitorOs> = {
  macos: 'mac',
  windows: 'windows',
  linux: 'linux',
  'chrome os': 'linux',
  'chromium os': 'linux',
  android: 'android',
  ios: 'ios',
};

/**
 * The visitor's system, or null when nothing names one. Order: the Client Hints
 * platform, then the User-Agent, with touch points separating an iPad from a Mac.
 */
export function detectVisitorOs(userAgent: string | null | undefined, hints: VisitorOsHints = {}): VisitorOs | null {
  const touchMac = (os: VisitorOs) => (os === 'mac' && (hints.maxTouchPoints ?? 0) > 1 ? 'ios' : os);
  const hinted = HINT_PLATFORMS[(hints.platform ?? '').replace(/"/g, '').trim().toLowerCase()];
  if (hinted) return touchMac(hinted);

  const ua = userAgent ?? '';
  if (!ua) return null;
  // Phones and tablets first: Android's User-Agent also says "Linux".
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows NT|Win64|Win32/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return touchMac('mac');
  if (/Linux|X11|CrOS/i.test(ua)) return 'linux';
  return null;
}

/** The system as a desktop one, or null for a phone, a tablet or an unknown system. */
export function desktopOsOf(os: VisitorOs | null): DesktopOs | null {
  return os !== null && (DESKTOP_OSES as readonly string[]).includes(os) ? (os as DesktopOs) : null;
}

/** The desktop system a User-Agent comes from: `desktopOsOf(detectVisitorOs(...))`. */
export function detectDesktopOs(userAgent: string | null | undefined, hints?: VisitorOsHints): DesktopOs | null {
  return desktopOsOf(detectVisitorOs(userAgent, hints));
}

/** Apple systems use the Command key for shortcuts; every other system uses Control. */
function usesCommandKey(os: VisitorOs | null): boolean {
  return os === 'mac' || os === 'ios';
}

/** A shortcut as its hint reads on the visitor's system: `⌘K` or `Ctrl K`. */
export function shortcutLabel(os: VisitorOs | null, key: string): string {
  return usesCommandKey(os) ? `⌘${key}` : `Ctrl ${key}`;
}
