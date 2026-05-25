/**
 * Shared Date Formatting Utilities
 * Single source of truth for date formatting across the application
 */

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/**
 * Split an ISO date / date-time string into `[year, month, day]` strings.
 * Internal — date-only inputs avoid the `new Date(...)` timezone shift
 * (which renders `"2025-11-11"` as Nov 10 west of UTC).
 */
function splitYmd(dateString: string): [string, string, string] | null {
  const head = dateString.split('T')[0]
  const parts = head.split('-')
  if (parts.length !== 3) return null
  return [parts[0], parts[1], parts[2]]
}

/**
 * Format release date — avoids timezone shifts.
 * @returns e.g. `"November 11, 2025"`
 */
export function formatReleaseDate(dateString: string): string {
  const ymd = splitYmd(dateString)
  if (!ymd) return dateString
  const [year, month, day] = ymd
  return `${MONTHS_LONG[parseInt(month) - 1]} ${parseInt(day)}, ${year}`
}

/**
 * Short-form date — `"Jan 5, 2025"`. Same TZ-safe parsing as
 * `formatReleaseDate`; differs only in month abbreviation. Single source
 * of truth for the short-month-day-year shape used across hub admin
 * cards (waitlist, publication, media, investor, campaign, etc.) and
 * lib chat cards (campaign-card-admin).
 */
export function formatDateShort(dateString: string): string {
  const ymd = splitYmd(dateString)
  if (!ymd) return dateString
  const [year, month, day] = ymd
  return `${MONTHS_SHORT[parseInt(month) - 1]} ${parseInt(day)}, ${year}`
}

/**
 * Slash-form date — `"11/11/2025"`. TZ-safe (string-split, no
 * `new Date(...)`). Used by hub admin product-release + customer-
 * interview cards where the compact MM/DD/YYYY layout is desired.
 */
export function formatDateSlashUTC(dateString: string): string {
  const ymd = splitYmd(dateString)
  if (!ymd) return dateString
  const [year, month, day] = ymd
  return `${month}/${day}/${year}`
}
