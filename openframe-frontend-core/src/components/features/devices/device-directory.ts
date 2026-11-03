import { presentationFor } from '../../../utils/presentation-for';
import type { DeviceRow } from './types';

/** The schema's `DirectoryUserLink`: who a device is tied to in a directory. */
export type DeviceDirectoryUserLink = 'PRIMARY' | 'SHARED' | 'NONE';

/** The schema's `DirectorySource`: a directory that knows a device. */
export type DeviceDirectorySource = 'MICROSOFT_365' | 'GOOGLE_WORKSPACE';

const USER_LINK_LABELS = {
  PRIMARY: 'Primary user',
  SHARED: 'Shared',
  NONE: 'No user',
} satisfies Record<DeviceDirectoryUserLink, string>;

const SOURCE_LABELS = {
  MICROSOFT_365: 'M365',
  GOOGLE_WORKSPACE: 'GOOGLE',
} satisfies Record<DeviceDirectorySource, string>;

/** The USER funnel's option (Figma 1136:64807). A value this build does not know keeps its own name. */
export function directoryUserLinkLabel(link: string): string {
  return presentationFor(USER_LINK_LABELS, link) ?? link;
}

/** The SOURCES tag: which directory knows the device. */
export function directorySourceLabel(source: string): string {
  return presentationFor(SOURCE_LABELS, source) ?? source;
}

const EMPTY_USER = '—';

// The row carries the wire's string: a member compared to it is typed here, so a misspelt one fails to compile.
const PRIMARY_LINK: DeviceDirectoryUserLink = 'PRIMARY';
const SHARED_LINK: DeviceDirectoryUserLink = 'SHARED';

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
  if (device.directoryUserLink === PRIMARY_LINK) {
    return { name: device.directoryUserName ?? EMPTY_USER, detail: USER_LINK_LABELS.PRIMARY };
  }
  if (device.directoryUserLink === SHARED_LINK) {
    const count = device.directoryUserCount ?? 0;
    return { name: USER_LINK_LABELS.SHARED, detail: `${count} recent ${count === 1 ? 'user' : 'users'}` };
  }
  return { name: EMPTY_USER, detail: null };
}
