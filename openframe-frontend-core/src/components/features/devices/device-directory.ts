import type { DeviceRow } from './types';

const USER_LINK_LABELS: Record<string, string> = {
  PRIMARY: 'Primary user',
  SHARED: 'Shared',
  NONE: 'No user',
};

const SOURCE_LABELS: Record<string, string> = {
  MICROSOFT_365: 'M365',
  GOOGLE_WORKSPACE: 'GOOGLE',
};

/** The USER funnel's option (Figma 1136:64807). A value this build does not know keeps its own name. */
export function directoryUserLinkLabel(link: string): string {
  return USER_LINK_LABELS[link] ?? link;
}

/** The SOURCES tag: which directory knows the device. */
export function directorySourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

const EMPTY_USER = '—';

/**
 * The USER cell's two lines (Figma 865:55733): the primary user over "Primary user", "Shared" over how many, or the
 * empty mark when nobody is tied to the device.
 */
export function directoryUserLines(
  device: Pick<DeviceRow, 'directoryUserLink' | 'directoryUserName' | 'directoryUserCount'>,
): {
  name: string;
  detail: string | null;
} {
  if (device.directoryUserLink === 'PRIMARY') {
    return { name: device.directoryUserName ?? EMPTY_USER, detail: USER_LINK_LABELS.PRIMARY };
  }
  if (device.directoryUserLink === 'SHARED') {
    const count = device.directoryUserCount ?? 0;
    return { name: USER_LINK_LABELS.SHARED, detail: `${count} recent ${count === 1 ? 'user' : 'users'}` };
  }
  return { name: EMPTY_USER, detail: null };
}
