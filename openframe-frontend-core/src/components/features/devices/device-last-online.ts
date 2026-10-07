import { formatRelativeTime } from '../../../utils/date-utils';

/** "Last Online: 5m ago": the line under a device's name wherever a row names a device; "Last Online: , " when never seen. */
export function formatLastOnline(lastSeen: string | Date | null | undefined): string {
  return `Last Online: ${lastSeen ? formatRelativeTime(lastSeen) : '—'}`;
}
