/**
 * The day a chat was last active, as the page header of a chat shows it:
 * "Today", "Yesterday", "9 Oct", or "9 Oct 2025" outside the current year.
 * Local days, the same boundaries the chat lists group by. `null` for a
 * missing or unparsable timestamp, so the caller simply leaves the part out.
 */
export function chatDayLabel(timestamp: Date | string | null | undefined, now: Date = new Date()): string | null {
  if (!timestamp) return null;
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const time = date.getTime();
  if (Number.isNaN(time)) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // A clock a little ahead of ours still means today.
  if (time >= startOfToday) return 'Today';
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  if (time >= startOfYesterday) return 'Yesterday';
  return new Intl.DateTimeFormat(
    'en-GB',
    date.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  ).format(date);
}
