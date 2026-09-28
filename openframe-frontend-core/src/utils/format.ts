/**
 * Utility functions for formatting data
 */

import type { ProgramInstant } from './program-instant';

/**
 * Format a date to a human-readable string
 * @param date - The date to format (Date object or ISO string)
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  },
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    console.warn('Invalid date provided to formatDate:', date);
    return 'Invalid Date';
  }

  // UTC by default (see `formatDateWithTimezone`); a caller may still name a
  // zone via `options.timeZone`, which is passed as THE zone, not a field.
  return formatDateWithTimezone(dateObj, options.timeZone ?? null, options);
}

/**
 * Format a number with thousands separators
 * @param num - The number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format a price with currency symbol
 * @param price - The price to format
 * @param currency - The currency code
 * @returns Formatted price string
 */
export function formatPrice(price: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
}

/**
 * Format bytes to a human-readable string (KB, MB, GB, etc.)
 * @param bytes - The number of bytes
 * @param decimals - Number of decimal places
 * @returns Formatted bytes string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Compact bytes formatter using the single-letter unit `'B'` (not
 * `'Bytes'`). Used by upload-progress UIs where horizontal space is
 * tight and the longer "Bytes" string wraps. Tops out at `TB`.
 * @example formatBytesShort(0) → "0 B"; formatBytesShort(1536) → "1.5 KB"
 */
export function formatBytesShort(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * File-size formatter (1 decimal place, `'B'` unit, caps at `GB`).
 * Hub historical semantics — distinct from `formatBytesShort` (2dp) and
 * `formatBytes` (2dp / `'Bytes'`). Lifted from the hub during the doc-viewer
 * unification so all upload UIs, publication cards, and data-room file-size
 * displays render the same way.
 * @example formatFileSize(0) → "0 B"; formatFileSize(1500) → "1.5 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format large numbers to abbreviated form (K, M, B) with no decimal points
 * @param num - The number to format
 * @returns Formatted number string (e.g., "1K", "2M", "3B")
 */
export function formatLargeNumber(num: number): string {
  if (num === 0) return '0';

  // Handle negative numbers
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  let result: string;

  if (absNum >= 1_000_000_000) {
    // Billions
    result = `${Math.floor(absNum / 1_000_000_000)}B`;
  } else if (absNum >= 1_000_000) {
    // Millions
    result = `${Math.floor(absNum / 1_000_000)}M`;
  } else if (absNum >= 1_000) {
    // Thousands
    result = `${Math.floor(absNum / 1_000)}K`;
  } else {
    // Less than 1000, show as-is
    result = Math.floor(absNum).toString();
  }

  return isNegative ? `-${result}` : result;
}

/**
 * Abbreviate large numbers for compact display.
 * 1 200 → 1.2K , 15 000 → 15K , 2 000 000 → 2M
 * @param n Number to format
 */
export function formatAbbreviatedNumber(n: number): string {
  if (n >= 1_000_000_000) {
    const value = n / 1_000_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    const value = n / 1_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const value = n / 1_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}K`;
  }
  return n.toLocaleString();
}

/**
 * Two-letter uppercase initials from the FIRST + LAST word of a name.
 * Used by avatar-style fallbacks (SquareAvatar, EntityImage) where
 * "John Michael Doe" → "JD" reads better than "JM".
 *
 * Returns `''` for empty / whitespace-only input. Single-word names
 * return a single uppercase letter. Pure — same input always produces
 * the same output, no locale or timezone surface.
 */
/**
 * Two-letter uppercase initials from the FIRST + SECOND word of a name.
 * Used as SquareAvatar / EntityImage / EntityAuthorCard fallback across
 * admin and public pages in both the lib and the hub. Handles empty
 * strings, all-whitespace input, and single-word names cleanly — always
 * returns at least one character so the fallback slot is never empty.
 *
 * Single source of truth: every "first-letter of each word, uppercase,
 * max 2 chars" computation across hub + lib MUST come through here.
 */
export interface NameInitialsOptions {
  /** How many letters to keep (default 2). */
  maxLetters?: number;
  /**
   * `'all'` (default) takes the leading words; `'first-last'` takes the FIRST and
   * LAST word, which is what a person's initials mean for a middle-name case.
   */
  pick?: 'all' | 'first-last';
}

export function nameInitials(
  name: string | null | undefined,
  fallback: string = 'E',
  options: NameInitialsOptions = {},
): string {
  const { maxLetters = 2, pick: mode = 'all' } = options;
  const source = typeof name === 'string' ? name.trim() : '';
  const words = source.length > 0 ? source.split(/\s+/).filter(Boolean) : [];
  const chosen =
    mode === 'first-last' && words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, maxLetters);
  const letters = chosen
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, maxLetters)
    .join('');
  return (letters || fallback).toUpperCase();
}

/**
 * A PERSON's initials: first + last word, empty when there is no name.
 * THE named policy for avatars and person cells (replaces `getFirstLastInitials`).
 */
export function personInitials(name?: string | null): string {
  return nameInitials(name, '', { pick: 'first-last' });
}

/**
 * A PERSON's first name: the first whitespace-delimited word, or `fallback`
 * (default `null`) when there is nothing usable. THE named first-name policy,
 * beside `personInitials`, so a greeting, a byline and a people cell agree on
 * leading whitespace and on an empty name.
 */
export function personFirstName(name: string | null | undefined): string | null;
export function personFirstName(name: string | null | undefined, fallback: string): string;
export function personFirstName(name: string | null | undefined, fallback: string | null = null): string | null {
  const first = (typeof name === 'string' ? name.trim() : '').split(/\s+/)[0];
  return first || fallback;
}

/** A single leading letter, `?` when there is no name. THE named one-letter policy. */
export function singleInitial(name?: string | null): string {
  return nameInitials(name, '?', { maxLetters: 1 });
}

/**
 * Format seconds to MM:SS or HH:MM:SS format
 * Used for media durations (podcasts, videos)
 * Returns: "MM:SS" or "HH:MM:SS" if hours > 0
 */
export function formatDurationMMSS(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds to compact human-readable duration
 * Used for displaying duration in cards and headers (media cards, program
 * headers, meeting-duration chips).
 * Returns: "Xh Xm", "Xh" (whole hours), or "X min"
 *
 * Whole hours deliberately drop the zero-minutes tail (`3600 → "1h"`, not
 * `"1h 0m"`) — this matches the hub `formatMinutesOrDash` docblock that
 * already advertised `"2h"`. Distinct from `formatDuration` (long words,
 * seconds input), `formatDurationFromMs` (elapsed-time telemetry, `"30.0m"`),
 * `formatDurationMMSS` (clock style), `formatDurationFromRange` (two dates).
 */
export function formatDurationCompact(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * THE date/time renderer. Every date or time this package presents goes through
 * `formatDateWithTimezone` (or its clock sibling `formatTimeWithTimezone`) — the
 * named helpers below are presets over it, not separate implementations.
 *
 * Why one: each helper used to decide the zone for itself — `timeZone: 'UTC'`
 * here, none at all there (so the MACHINE's zone), hand-built `MM/DD/YYYY` from
 * `getUTC*` getters, month names looked up in an array — and the answers
 * disagreed. A date rendered without an explicit zone is a different day on the
 * server (Vercel = UTC) than in a browser west of it, which is both a wrong day
 * and a React #418 hydration mismatch. The zone is therefore a REQUIRED decision
 * at every call, made in exactly one of three ways:
 *
 * - an IANA zone (`'America/New_York'`): a record that HAS a zone renders in it
 *   — an event's wall clock is the event's, whoever is looking;
 * - `null` / `undefined`: pinned to UTC — content dates (published, released,
 *   periods) that must read the same on the server and every client;
 * - `VIEWER_TIMEZONE`: the runtime's own zone — ONLY for client-rendered UI whose
 *   whole meaning is "your local time" (a date picker, a booking slot in the
 *   visitor's zone, a "last active" stamp in an app shell).
 *
 * An unresolvable zone (legacy data) degrades to UTC rather than throwing, so a
 * bad row cannot take down the surface rendering it.
 */
export const VIEWER_TIMEZONE = 'viewer';

type DateInput = Date | string | number | null | undefined;

/** The shapes this package renders, by name. A raw `Intl` field set is also
 *  accepted for a one-off shape; the ZONE is never taken from it — it is the
 *  explicit `timezone` argument, so no caller can smuggle a default back in. */
export type ZonedDateStyle =
  | 'medium'
  | 'weekday'
  | 'long'
  | 'numeric'
  | 'monthYear'
  | 'monthYearShort'
  | 'numericDateTime'
  | 'mediumDateTime'
  | 'weekdayDateTimeZoned'
  | 'shortWeekdayDateTime'
  | 'numericDateTime24h'
  | 'localeDateTime';

const ZONED_DATE_STYLES: Record<ZonedDateStyle, Intl.DateTimeFormatOptions> = {
  /** Mar 19, 2026 */
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  /** Thursday, March 19 */
  weekday: { weekday: 'long', day: 'numeric', month: 'long' },
  /** March 19, 2026 */
  long: { year: 'numeric', month: 'long', day: 'numeric' },
  /** 03/19/2026 */
  numeric: { year: 'numeric', month: '2-digit', day: '2-digit' },
  /** March 2026 */
  monthYear: { year: 'numeric', month: 'long' },
  /** Mar 2026 */
  monthYearShort: { year: 'numeric', month: 'short' },
  /** 03/19/2026, 9:18 PM */
  numericDateTime: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  },
  /** Mar 19, 2026, 9:18 PM */
  mediumDateTime: { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  /** Thursday, March 19 at 9:18 PM EDT */
  weekdayDateTimeZoned: {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  },
  /** Thu, Mar 19, 9:18 PM */
  shortWeekdayDateTime: { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  /** 03/19/2026, 21:18 */
  numericDateTime24h: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },
  /** 3/19/2026, 9:18:00 PM — the runtime's own default date-time shape */
  localeDateTime: {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  },
};

/** Constructing an `Intl.DateTimeFormat` is expensive and these are called per
 *  row; one instance per (locale, zone, fields) is enough. */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function zonedFormatter(locale: string | undefined, fields: Intl.DateTimeFormatOptions, timeZone: string | undefined) {
  const key = JSON.stringify([locale ?? null, timeZone ?? null, fields]);
  let fmt = FORMATTERS.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { ...fields, timeZone });
    FORMATTERS.set(key, fmt);
  }
  return fmt;
}

/**
 * THE zone rule, applied once: an IANA zone renders in that zone, `null` pins to
 * UTC, `VIEWER_TIMEZONE` uses the runtime's zone — and an UNRESOLVABLE zone
 * degrades to UTC instead of throwing, so a bad row cannot take down the
 * surface rendering it. (A bare "EST" does not degrade: it resolves as a fixed
 * UTC-5 alias, a different wall clock from America/New_York under DST — a data
 * problem this cannot see.)
 */
function formatterFor(
  timezone: string | null | undefined,
  fields: Intl.DateTimeFormatOptions,
  locale: string | undefined,
): Intl.DateTimeFormat {
  const zone = timezone === VIEWER_TIMEZONE ? undefined : timezone || 'UTC';
  try {
    return zonedFormatter(locale, fields, zone);
  } catch {
    return zonedFormatter(locale, fields, 'UTC');
  }
}

function toValidDate(date: DateInput): Date | null {
  if (date === null || date === undefined || date === '') return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Render a date (and, for a date-time style, its time) in an explicit zone.
 * Returns `''` for a missing or unparseable value.
 *
 * `options.viewerLocale` renders in the runtime's own LOCALE instead of the
 * fixed `en-US` — for client-only UI that should read the way its user writes
 * dates. The locale is never implied, for the same hydration reason as the zone.
 */
export function formatDateWithTimezone(
  date: DateInput,
  timezone?: string | null,
  style: ZonedDateStyle | Intl.DateTimeFormatOptions = 'medium',
  options?: { viewerLocale?: boolean },
): string {
  const dateObj = toValidDate(date);
  if (!dateObj) return '';
  const { timeZone: _ignored, ...fields } = typeof style === 'string' ? ZONED_DATE_STYLES[style] : style;
  return formatterFor(timezone, fields, options?.viewerLocale ? undefined : 'en-US').format(dateObj);
}

/**
 * `2026/03/19, 21:18` — a sortable, locale-independent date-time for dense
 * operator UI (log lines, device "last seen").
 *
 * No locale renders this shape, so it is assembled from `formatToParts` of the
 * SAME formatter every other date uses: the zone decision cannot drift from the
 * rest of the package. It replaces two copies that built the string by hand from
 * `getUTC*` getters and printed `NaN/NaN/NaN` for an unparseable value.
 */
export function formatDateTimeYmd(date: DateInput, timezone?: string | null, options?: { separator?: string }): string {
  const dateObj = toValidDate(date);
  if (!dateObj) return '';
  const parts = formatterFor(
    timezone,
    { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
    'en-US',
  ).formatToParts(dateObj);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}/${part('month')}/${part('day')}${options?.separator ?? ', '}${part('hour')}:${part('minute')}`;
}

/**
 * A wall-clock time in an explicit zone — the clock sibling of
 * `formatDateWithTimezone`, rendered by it, so the pair cannot disagree about
 * which zone a date and the time beside it are stated in.
 *
 * `withZoneLabel` appends the short zone name ("4:00 PM EDT") for plain joined
 * strings where there is no room for a separately styled label.
 *
 * Returns: "4:00 PM", or "4:00 PM EDT" with `withZoneLabel`.
 */
export function formatTimeWithTimezone(
  date: DateInput,
  timezone?: string | null,
  options?: { withZoneLabel?: boolean; viewerLocale?: boolean },
): string {
  return formatDateWithTimezone(
    date,
    timezone,
    {
      hour: 'numeric',
      minute: '2-digit',
      // A viewer-locale clock uses the locale's own 12/24h convention.
      ...(options?.viewerLocale ? {} : { hour12: true }),
      ...(options?.withZoneLabel ? { timeZoneName: 'short' as const } : {}),
    },
    { viewerLocale: options?.viewerLocale },
  );
}

/**
 * THE program date — the date half of what `formatWebinarTimeMeta` renders as
 * the time half, taking the same already-resolved `ProgramInstant` so the two
 * cannot name different moments.
 *
 * Every program surface used to write this branch itself:
 * `zoned.instant ? formatDateWithTimezone(...) :
 * formatUtc(new Date(item.date), 'EEEE d MMMM')` — four copies, and they did
 * not agree. Three stated the condition off the resolved instant and the
 * fourth off a local timezone variable; worse, the two branches rendered
 * DIFFERENT SHAPES, so whether a row happened to declare a zone decided
 * whether its headline read "Thursday, March 19" or "Thursday 19 March".
 *
 * There is no UTC branch here because there never needed to be one:
 * `formatDateWithTimezone` already pins to UTC when handed no zone, which is
 * the same React #418 fix the hand-rolled `formatUtc` twins existed for — they
 * were a date-fns re-implementation of a fallback that was already inside the
 * function they sat next to.
 */
export function formatProgramDate(at: ProgramInstant, style: ZonedDateStyle = 'medium'): string {
  // `timezone` is already null for a day-valued row, so this one call covers
  // the zoned render, the no-zone render and the override render alike.
  return formatDateWithTimezone(at.instant ?? at.utcDate, at.timezone, style);
}

/**
 * Do these two endpoints describe a forward-running interval?
 *
 * THE ordering rule for every renderer in this file. A range that runs
 * backwards is not a short range, it is a false one: a card shipped "-45m"
 * from a row whose `end_at` preceded its `start_at`, and the clock renderer
 * printed "11:00 PM - 9:00 PM" from the same shape. Both refuse it here.
 *
 * The host app enforces the same rule at INGEST (it drops such an `end_at`
 * rather than storing it) and states the comparison itself, because the module
 * that owns it there is a dependency-free leaf its mapper tests rely on. Two
 * statements of one comparison, across a package boundary, knowingly — if this
 * one changes, that one has to.
 */
export function isOrderedRange(from: Date | string | null | undefined, to: Date | string | null | undefined): boolean {
  if (!from || !to) return false;
  const a = (typeof from === 'string' ? new Date(from) : from).getTime();
  const b = (typeof to === 'string' ? new Date(to) : to).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && b > a;
}

/**
 * Calculate and format duration between two timestamps
 * Used for webinar durations
 * Returns: "1h 30m" or "45m"
 *
 * Returns `''` — the same "nothing to show" this function already returns for a
 * missing endpoint — when the range is not a positive, real duration. An event
 * whose `end_at` precedes its `start_at` is corrupt data, and the unguarded
 * subtraction printed it literally: a live webinar row rendered "-45m" on the
 * card. An unparseable timestamp printed "NaNm" the same way. A renderer shows
 * nothing rather than an impossible value; the write path is what must reject
 * the row. (Note the negative case never even reached the `>= 60` branch, so
 * -90 minutes rendered as "-90m" rather than "-1h 30m" — the output was not
 * just wrong, it was inconsistently wrong.)
 */
export function formatDurationFromRange(
  startAt: string | Date | null | undefined,
  endAt: string | Date | null | undefined,
): string {
  // ONE statement of "is this a forward-running interval", shared with
  // `formatProgramTimeRange`. This function's guard and that one's were written
  // separately — the second one's comment even named this as its sibling — and
  // an ordering rule stated twice is a rule that can disagree with itself about
  // the same row.
  if (!isOrderedRange(startAt, endAt)) return '';

  // Non-null past the guard above, which rejects null/unparseable endpoints.
  const start = typeof startAt === 'string' ? new Date(startAt) : (startAt as Date);
  const end = typeof endAt === 'string' ? new Date(endAt) : (endAt as Date);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (minutes <= 0) return '';

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * UTC-anchored date formatter — distinct from the local-rendering
 * `formatDate` above. RAG mappers + audit-style consumers want UTC anchor
 * so date-only strings (`'2024-08-15'`) don't drift across timezones, AND
 * a `'N/A'` (or caller-supplied) fallback for missing values so the LLM
 * never sees a blank.
 *
 * Accepts:
 *   - ISO date or timestamp string (`'2024-08-15'` or `'2024-08-15T10:30:00Z'`)
 *   - Numeric epoch milliseconds
 *   - Numeric string (treated as epoch ms — Slack and GitHub timestamps
 *     sometimes arrive that way)
 *   - `null` / `undefined` / empty / unparseable → returns `options.fallback`
 *
 * Date-only strings (no `'T'`) get `T00:00:00Z` appended so they anchor to
 * UTC midnight rather than midnight in the runtime's local timezone.
 */
export interface FormatDateUTCOptions {
  /** Returned for null/undefined/empty/unparseable input. Defaults to 'N/A'. */
  fallback?: string;
  /** 'UTC' (default) or 'local' — switch off the UTC anchor when audit
   *  stability matters less than local relevance (chat-card timestamps). */
  timezone?: 'UTC' | 'local';
}

export function formatDateUTC(value: string | number | null | undefined, options: FormatDateUTCOptions = {}): string {
  const { fallback = 'N/A', timezone = 'UTC' } = options;

  if (value === null || value === undefined || value === '') return fallback;

  let ms: number;
  if (typeof value === 'number') {
    ms = value;
  } else {
    // String input — first try to interpret as a numeric epoch (Slack/GitHub
    // sometimes arrive that way). Number('') is 0, but we already ruled out
    // empty strings above.
    const n = Number(value);
    if (Number.isFinite(n) && n > 0 && /^-?\d+(\.\d+)?$/.test(value.trim())) {
      ms = n;
    } else {
      // ISO string — for date-only forms, anchor to UTC midnight to avoid
      // timezone-offset drift (preserves the original RAG-mapper contract).
      ms = Date.parse(value.includes('T') ? value : value + 'T00:00:00Z');
    }
  }

  if (!Number.isFinite(ms)) return fallback;

  return formatDateWithTimezone(ms, timezone === 'local' ? VIEWER_TIMEZONE : null, 'medium');
}

/**
 * Format a reporting-month value (`entry_month`) as "Mon YYYY" / "Month YYYY",
 * always anchored to UTC. THE single home for the "What I Shipped" month label —
 * both the lib card (`'short'`) and the hub detail page (`'long'`) call this, so
 * the React #418 UTC-pin convention lives in exactly one place. Returns `null`
 * for empty input (callers omit the label entirely).
 */
export function formatEntryMonthUTC(
  entryMonth: string | null | undefined,
  style: 'short' | 'long' = 'short',
): string | null {
  if (!entryMonth) return null;
  return formatDateWithTimezone(entryMonth, null, style === 'long' ? 'monthYear' : 'monthYearShort');
}

/**
 * Format a date string as `MM/DD/YYYY` for legal-document display
 * (privacy policy, terms of service). Locale-stable: always en-US.
 */
export function formatLegalDate(dateInput: string): string {
  // Was rendered with NO zone, so a document dated `2026-03-01` read 02/28/2026
  // for any reader west of UTC — and differently on the server. A legal date is
  // a calendar date: UTC-pinned, like every other content date.
  return formatDateWithTimezone(dateInput, null, 'numeric');
}

/**
 * Format a currency value as `$1,234`. Returns `'N/A'` for null/undefined.
 * USD-rounded (no cents). Used on KPI cards + investor pages.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a percent value as `12.50%`. Returns `'N/A'` for null/undefined.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return `${value.toFixed(2)}%`;
}

/**
 * Whole-dollar price (no cents) — `$1,234`. Configurable currency code.
 */
export function formatWholeDollars(price: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

// =============================================================================
// Metric Formatting (for KPI cards / investor updates)
// =============================================================================

export type MetricFormat = 'number' | 'currency' | 'percentage' | 'months';

/**
 * Polarity determines whether an increase is good or bad.
 * - 'positive': higher is better (revenue, users, MRR) → up = green, down = red
 * - 'negative': higher is worse (burn rate, churn, CAC) → up = red, down = green
 * - 'neutral':  no judgment (headcount, runway) → always gray
 */
export type TrendPolarity = 'positive' | 'negative' | 'neutral';

/**
 * Format a metric value with compact notation ($1.2M, 150K, 12 months).
 */
export function formatCompactMetric(
  value: number,
  format: MetricFormat = 'number',
  options?: { prefix?: string; suffix?: string },
): string {
  if (value === 0 || value === null || value === undefined) {
    if (format === 'currency') return `${options?.prefix || '$'}0`;
    if (format === 'percentage') return '0%';
    if (format === 'months') return `0 ${options?.suffix || 'months'}`;
    return '0';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (format === 'currency') {
    const prefix = options?.prefix || '$';
    const compact = (val: number, divisor: number, suffix: string) => {
      const divided = val / divisor;
      const formatted = divided % 1 === 0 ? divided.toFixed(0) : divided.toFixed(1);
      return `${sign}${prefix}${formatted}${suffix}`;
    };
    if (absValue >= 1_000_000_000) return compact(absValue, 1_000_000_000, 'B');
    if (absValue >= 1_000_000) return compact(absValue, 1_000_000, 'M');
    if (absValue >= 1_000) return `${sign}${prefix}${(absValue / 1_000).toFixed(0)}K`;
    return `${sign}${prefix}${absValue.toLocaleString()}`;
  }

  if (format === 'percentage') {
    return `${sign}${absValue}%`;
  }

  if (format === 'months') {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded} ${options?.suffix || 'months'}`;
  }

  if (absValue >= 1_000_000) return `${sign}${(absValue / 1_000_000).toFixed(1)}M`;
  if (absValue >= 1_000) return `${sign}${(absValue / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

/**
 * Get ODS trend colors based on direction AND polarity. Single source
 * of truth for trend coloring across hub + lib.
 */
export function getTrendColors(
  direction: 'up' | 'down' | 'neutral',
  polarity: TrendPolarity = 'positive',
): { textClass: string; badgeClass: string } {
  if (direction === 'neutral' || polarity === 'neutral') {
    return {
      textClass: 'text-ods-text-secondary',
      badgeClass: 'bg-ods-border text-ods-text-secondary',
    };
  }

  const isPositiveOutcome =
    (direction === 'up' && polarity === 'positive') || (direction === 'down' && polarity === 'negative');

  if (isPositiveOutcome) {
    return {
      textClass: 'text-ods-success',
      badgeClass: 'bg-ods-success-secondary text-ods-success',
    };
  }

  return {
    textClass: 'text-ods-error',
    badgeClass: 'bg-ods-error-secondary text-ods-error',
  };
}

/**
 * Format a date range as `Apr 20, 2026 — Jul 20, 2026`. Used on review
 * cycle list/detail rows and summary headers.
 *
 * Accepts either full ISO timestamps or bare `YYYY-MM-DD` dates. Bare
 * dates are interpreted in the viewer's LOCAL timezone — otherwise
 * `"2026-04-20"` renders as `"Apr 19"` west of UTC. DB values for cycle
 * period are stored as plain dates, so local-tz parsing is correct.
 */
export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '';
  // A bare `YYYY-MM-DD` is a calendar date: rendered UTC-pinned it reads as the
  // day written, on any machine. It used to be rebuilt as a LOCAL midnight and
  // rendered in the viewer's zone and locale, which got the day right only by
  // pairing two local conversions, and differed between server and client.
  const fmt = (s: string): string =>
    formatDateWithTimezone(s, /^\d{4}-\d{2}-\d{2}$/.test(s) ? null : VIEWER_TIMEZONE, 'medium') || s;
  return `${fmt(start)} — ${fmt(end)}`;
}

/**
 * Format an ISO date string as `"Jan 5, 2025 at 10:30 AM"`. Used by
 * admin podcast/webinar cards where the display needs both the short
 * date AND wall-clock time in a single readable phrase.
 *
 * Uses `new Date(...).toLocale*` (NOT the TZ-safe split) because the
 * source columns store full timestamps + the wall-clock half MUST
 * render in the viewer's local timezone (a podcast scheduled "10:30 AM
 * EST" should display "10:30 AM" for the Eastern admin, "7:30 AM" for
 * the Pacific admin — viewer-local is the right semantics here, unlike
 * date-only fields).
 */
export function formatDateTimeAt(dateString: string): string {
  // Viewer-local by design (see above): the date and the time are stated in the
  // SAME zone, by the same renderer.
  const dateStr = formatDateWithTimezone(dateString, VIEWER_TIMEZONE, 'medium');
  const timeStr = formatTimeWithTimezone(dateString, VIEWER_TIMEZONE);
  return dateStr && timeStr ? `${dateStr} at ${timeStr}` : '';
}

/**
 * Format a duration measured in MILLISECONDS as a compact human-readable
 * string. Returns `"0ms"` for null/NaN/negative, then `Xms` → `X.Xs` →
 * `X.Xm` as the input grows. Used by job-runs / orchestrator dashboards
 * where elapsed milliseconds is the natural unit.
 *
 * Distinct from `formatDuration(seconds)` (verbose `"X hours Y minutes"`)
 * and `formatDurationMMSS(seconds)` (media timecode `MM:SS`).
 */
export function formatDurationFromMs(ms: number | null | undefined): string {
  if (!ms || isNaN(ms) || ms < 0) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format seconds to verbose human-readable duration: `"X seconds"`,
 * `"X minutes"`, `"X hours Y minutes"`. Use this for human-readable
 * spans; for media timecodes use `formatDurationMMSS`; for compact
 * media labels use `formatDurationCompact`; for elapsed milliseconds
 * use `formatDurationFromMs`.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (minutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
}

// =============================================================================
// Text formatting helpers (proper-case, HTML strip, bio cleanup)
// =============================================================================

/**
 * Title-case a slug-like string: split on `separator`, capitalize each word.
 *   `titleCaseFromSlug('customer-success')`      → `"Customer Success"`
 *   `titleCaseFromSlug('self_hosted', '_')`      → `"Self Hosted"`
 *
 * The separator is EXPLICIT per call site on purpose: `formatUnderscoreText`
 * delegates with `'_'` (its output stays byte-identical — `'self-hosted'`
 * remains `"Self-hosted"` on the vendor classification/pricing labels), while
 * scheduling-purpose labels pass `'-'`. A combined `[-_]` splitter would have
 * silently changed shipped vendor-facing strings.
 */
export function titleCaseFromSlug(text: string, separator: string = '-'): string {
  return text
    .split(separator)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format underscore-separated text into proper case.
 *   `"self_hosted"` → `"Self Hosted"`
 *   `"open_source"` → `"Open Source"`
 *
 * Thin delegate over {@link titleCaseFromSlug} with an underscore separator.
 */
export function formatUnderscoreText(text: string): string {
  return titleCaseFromSlug(text, '_');
}

/**
 * Strip HTML tags and decode common HTML entities from a string.
 * Useful for cleaning API responses that contain HTML content.
 *
 * @example
 * stripHtml('<p>Hello <strong>World</strong></p>') // "Hello World"
 * stripHtml('Test &amp; Example') // "Test & Example"
 */
export function stripHtml(html: string): string {
  // Iterative tag-strip — a single pass is bypass-able by inputs like
  // `<scr<script>ipt>`: stripping the inner `<script>` leaves the outer
  // `<script>` reassembled. Loop until the string is stable so multi-
  // character bypasses cannot survive (CodeQL
  // `js/incomplete-multi-character-sanitization`). `<[^<>]*>` rejects
  // `<` inside the tag body so each pass is itself ReDoS-safe (no
  // backtracking on `<<<<<...<>` inputs).
  let noTags = html;
  let prev: string;
  do {
    prev = noTags;
    noTags = noTags.replace(/<[^<>]*>/g, '');
  } while (noTags !== prev);

  // Decode entities. `&amp;` MUST come LAST so we don't double-decode
  // sequences like `&amp;lt;` (which should render as the LITERAL text
  // `&lt;`, not as `<`). All other named/numeric entities decode first;
  // only after those have been replaced do we collapse `&amp;` → `&`.
  return noTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Display label for the openmsp `vendors.classification` enum.
 * Falls back to proper-cased underscore split for values not in the
 * curated mapping.
 */
export function formatClassification(classification: string): string {
  const customMappings: Record<string, string> = {
    openframe_selected: 'OpenFrame Selected',
  };
  return customMappings[classification] || formatUnderscoreText(classification);
}

/**
 * Display label for the openmsp `vendors.pricing_model` enum.
 * Falls back to proper-cased underscore split for values not in the
 * curated mapping.
 */
export function formatPricingModel(pricingModel: string): string {
  const customMappings: Record<string, string> = {
    one_time: 'One-time Purchase',
    self_hosted: 'Self-hosted',
  };
  return customMappings[pricingModel] || formatUnderscoreText(pricingModel);
}

/**
 * Format a bio/about text from the profiles table for display.
 * Handles HTML content (e.g. `<p>` tags from rich text editors),
 * plain text passthrough, and null/undefined values.
 */
export function formatBioText(aboutHtml: string | null | undefined, fallback: string = ''): string {
  if (!aboutHtml || !aboutHtml.trim()) return fallback;

  if (aboutHtml.includes('<p')) {
    // `<p[^<>]*>` rejects `<` inside the tag so the automaton can't
    // backtrack on `<<<<<...<p>` inputs (ReDoS class fix vs. `<p[^>]*>`).
    const paragraphs = aboutHtml
      .split(/<p[^<>]*>/)
      .slice(1)
      .map(part => part.split('</p>')[0])
      .map(text => stripHtml(text).trim())
      .filter(text => text.length > 0);

    if (paragraphs.length > 0) return paragraphs.join(' ');
  }

  return stripHtml(aboutHtml).trim() || fallback;
}

/**
 * THE program CLOCK — one time, or a start–end range, in the resolved zone.
 *
 * The third member of the set beside `formatProgramDate` (the day) and
 * `formatWebinarTimeMeta` (time + duration), and it exists because the page
 * header rebuilt it locally: an `instant ?? utcDate` fallback and a
 * zone-labelled render — the same things the meta
 * helper owns, re-applied at the call site, which is exactly what that
 * helper's docblock says goes wrong. The header also appended the RAW IANA
 * name while the slot beneath it used the short name, so one component
 * printed "America/New_York" and "EDT" six lines apart.
 *
 * Only the LAST clock carries the zone label, so a range reads
 * "9:00 AM - 5:00 PM EDT" rather than labelling both ends.
 */
export function formatProgramTimeRange(
  at: ProgramInstant,
  opts: { startAt?: string | null; endAt?: string | null; withZoneLabel?: boolean } = {},
): string {
  // `instant` is null when the row declares no zone; `utcDate` is the canonical
  // value then, and the formatter's own UTC pin renders it deterministically.
  // Resolved ONCE — spelling this chain twice is how the previous version of
  // this pair drifted apart.
  const source = at.instant ?? at.utcDate ?? opts.startAt;
  const label = opts.withZoneLabel === true;
  // Each of these builds an `Intl.DateTimeFormat`, so they are computed once
  // rather than per branch.
  const bare = formatTimeWithTimezone(source, at.timezone);
  const labelled = label ? formatTimeWithTimezone(source, at.timezone, { withZoneLabel: true }) : bare;
  // An INVERTED range is not rendered as a range. Its sibling
  // `formatDurationFromRange` already refuses exactly this — its docblock
  // records the "-45m" that shipped on a card — and this renderer guarded the
  // unusable-endpoint cases but stopped one step short of the ordering check,
  // so a corrupt row read "11:00 PM - 9:00 PM EDT". The START is still true, so
  // it is kept; only the impossible pairing is dropped.
  const ordered = isOrderedRange(source, opts.endAt);
  const end = ordered && opts.endAt ? formatTimeWithTimezone(opts.endAt, at.timezone, { withZoneLabel: label }) : '';
  // An end with no usable start is not a range, and rendering it alone puts a
  // FINISH time where the reader expects a start. Say nothing instead.
  if (!bare) return '';
  // Only the LAST clock carries the label, so a range reads "9:00 AM - 5:00 PM EDT".
  return end ? `${bare} - ${end}` : labelled;
}

/**
 * "4:00 PM EDT · 45m" — a webinar's time and duration as one meta string.
 *
 * Extracted because this exact three-line composition existed in the chat card
 * and the public page header, and they DRIFTED: the card was corrected to read
 * the resolved display instant while the page still read the raw `start_at`.
 *
 * The split is the point: the TIME comes from the resolved `instant`, the
 * DURATION from `startAt`/`endAt`, because elapsed time is not a display date.
 * Both sides of the separator are gated, so neither a suppressed duration nor
 * an unrenderable time can leave one dangling.
 *
 * It takes the RESOLVED `ProgramInstant`, exactly as `formatProgramDate` does.
 * While it took `instant` / `timezone` as
 * loose fields, all four callers re-projected them off the same resolved value
 * and no two projections matched — so a zoneless webinar rendered "4:00 PM UTC"
 * on the public card and "4:00 PM" on the chat card, which exist to mirror each
 * other, and the detail page fell back to a different source instant from the
 * card's. Taking the value whole is what makes those disagreements unsayable.
 */
export function formatWebinarTimeMeta(
  at: ProgramInstant,
  opts: { startAt: string | null; endAt: string | null; withZoneLabel?: boolean },
): string {
  // The CLOCK is `formatProgramTimeRange`'s, not a second rendering of it: this
  // function restated the same decisions (the instant fallback, the labelled
  // render) thirty lines below the sibling that
  // owns them, and the two had already drifted apart on the fallback chain.
  // Only the DURATION is this function's own contribution.
  const duration = formatDurationFromRange(opts.startAt, opts.endAt);
  const time = formatProgramTimeRange(at, { startAt: opts.startAt, withZoneLabel: opts.withZoneLabel });
  return [time, duration].filter(Boolean).join(' · ');
}
