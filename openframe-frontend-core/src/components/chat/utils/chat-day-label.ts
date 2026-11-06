import { formatDateWithTimezone, VIEWER_TIMEZONE } from '../../../utils/format';

/**
 * The one rule for a chat's day caption — the chat page header ("· owner · day") and the day groups
 * of the history lists both read it: "Today", "Yesterday", then the day in the viewer's own zone and
 * locale ("9 Oct" / "Oct 9"), with the year when it is not this one. Local days; a time in the
 * future counts as today. `null` for a missing or unparsable timestamp, so the caller leaves it out.
 */
export function chatDayLabel(timestamp: Date | string | null | undefined, now: Date = new Date()): string | null {
  if (!timestamp) return null;
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (time >= startOfToday) return 'Today';
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  if (time >= startOfYesterday) return 'Yesterday';
  return formatDateWithTimezone(
    date,
    VIEWER_TIMEZONE,
    { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' },
    { viewerLocale: true },
  );
}
