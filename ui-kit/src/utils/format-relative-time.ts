/**
 * Format a timestamp as relative time with support for both past and future dates
 *
 * @param timestamp - ISO date string or timestamp in milliseconds
 * @returns Human-readable relative time string
 *
 * @example
 * // Past dates
 * formatRelativeTime('2024-01-01T00:00:00Z') // "5 days ago"
 * formatRelativeTime(Date.now() - 3600000) // "1 hour ago"
 *
 * // Future dates
 * formatRelativeTime(Date.now() + 86400000) // "in 1 day"
 *
 * // Edge cases
 * formatRelativeTime('') // "Not scheduled"
 * formatRelativeTime('invalid') // "Invalid date"
 * formatRelativeTime(Date.now()) // "just now"
 */
export function formatRelativeTime(timestamp: string | number): string {
  if (!timestamp) return 'Not scheduled';

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid date';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Future dates (next run times)
  if (diffMs < 0) {
    const absDiffSecs = Math.abs(diffSecs);
    const absDiffMins = Math.floor(absDiffSecs / 60);
    const absDiffHours = Math.floor(absDiffMins / 60);
    const absDiffDays = Math.floor(absDiffHours / 24);

    if (absDiffDays > 0) return `in ${absDiffDays} day${absDiffDays === 1 ? '' : 's'}`;
    if (absDiffHours > 0) return `in ${absDiffHours} hour${absDiffHours === 1 ? '' : 's'}`;
    if (absDiffMins > 0) return `in ${absDiffMins} minute${absDiffMins === 1 ? '' : 's'}`;
    return `in ${absDiffSecs} second${absDiffSecs === 1 ? '' : 's'}`;
  }

  // Past dates (completed times)
  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffSecs > 0) return `${diffSecs} second${diffSecs === 1 ? '' : 's'}`;
  return 'just now';
}
