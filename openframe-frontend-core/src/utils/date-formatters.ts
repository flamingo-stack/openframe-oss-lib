/**
 * Calendar-date presets.
 *
 * These format the DAY AS WRITTEN — the `YYYY-MM-DD` head of the input — so a
 * `"2025-11-11"` never renders as Nov 10 west of UTC. The rendering itself is
 * `formatDateWithTimezone` in `./format`: the day head is a UTC midnight
 * rendered UTC-pinned, which is exactly the day written, on any machine. They
 * used to look month names up in their own arrays.
 */

import { type ZonedDateStyle, formatDateWithTimezone } from './format';

/** Render the calendar day an ISO date/date-time string names, or return the
 *  input unchanged if it has no `YYYY-MM-DD` head. */
function formatDayHead(dateString: string, style: ZonedDateStyle): string {
  const ymd = splitYmd(dateString);
  if (!ymd) return dateString;
  return formatDateWithTimezone(ymd.join('-'), null, style) || dateString;
}

/**
 * Split an ISO date / date-time string into `[year, month, day]` strings.
 * Internal — date-only inputs avoid the `new Date(...)` timezone shift
 * (which renders `"2025-11-11"` as Nov 10 west of UTC).
 */
function splitYmd(dateString: string): [string, string, string] | null {
  const head = dateString.split('T')[0];
  const parts = head.split('-');
  if (parts.length !== 3) return null;
  return [parts[0], parts[1], parts[2]];
}

/**
 * Format release date — avoids timezone shifts.
 * @returns e.g. `"November 11, 2025"`
 */
export function formatReleaseDate(dateString: string): string {
  return formatDayHead(dateString, 'long');
}

/**
 * Short-form date — `"Jan 5, 2025"`. Same TZ-safe parsing as
 * `formatReleaseDate`; differs only in month abbreviation. Single source
 * of truth for the short-month-day-year shape used across hub admin
 * cards (waitlist, publication, media, investor, campaign, etc.) and
 * lib chat cards (campaign-card-admin).
 */
export function formatDateShort(dateString: string): string {
  return formatDayHead(dateString, 'medium');
}

/**
 * Slash-form date — `"11/11/2025"`. TZ-safe (string-split, no
 * `new Date(...)`). Used by hub admin product-release + customer-
 * interview cards where the compact MM/DD/YYYY layout is desired.
 */
export function formatDateSlashUTC(dateString: string): string {
  return formatDayHead(dateString, 'numeric');
}
