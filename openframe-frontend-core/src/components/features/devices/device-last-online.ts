import { formatRelativeTime } from '../../../utils/date-utils';
import { formatDate, formatTime } from '../../../utils/format-date';

/** "Last Online: 5m ago": the line under a device's name wherever a row names a device; "Last Online: , " when never seen. */
export function formatLastOnline(lastSeen: string | Date | null | undefined): string {
  return `Last Online: ${lastSeen ? formatRelativeTime(lastSeen) : '—'}`;
}

/**
 * When a device was last seen as the device lists print it: the short date then the time, in the viewer's zone and
 * locale; the empty mark for an instant that does not parse.
 */
export function formatDeviceDateTime(input: string): string {
  const date = formatDate(input);
  return date === '—' ? date : `${date} ${formatTime(input)}`;
}
