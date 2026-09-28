import { describe, expect, it } from 'vitest';

import { formatReleaseDate, formatDateShort, formatDateSlashUTC } from '../date-formatters';
import { formatAbsoluteDate, formatTicketFullTimestamp, formatTicketRelativeTime } from '../date-utils';
import {
  VIEWER_TIMEZONE,
  formatDateTimeYmd,
  formatDateUTC,
  formatDateWithTimezone,
  formatEntryMonthUTC,
  formatLegalDate,
  formatTimeWithTimezone,
} from '../format';

/**
 * Every date or time this package presents is rendered by
 * `formatDateWithTimezone`. The named helpers are presets over it, so these
 * tests pin the ONE rule — the zone is always an explicit decision — and that
 * the presets still produce the shapes their callers print.
 */
describe('formatDateWithTimezone — the zone is always explicit', () => {
  // 01:18 UTC on the 20th is 9:18 PM on the 19th in New York.
  const INSTANT = '2026-03-20T01:18:00Z';

  it('an IANA zone renders in that zone', () => {
    expect(formatDateWithTimezone(INSTANT, 'America/New_York')).toBe('Mar 19, 2026');
  });

  it('no zone pins to UTC, so the server and every client agree', () => {
    expect(formatDateWithTimezone(INSTANT, null)).toBe('Mar 20, 2026');
    expect(formatDateWithTimezone(INSTANT, undefined)).toBe('Mar 20, 2026');
  });

  it('a zone passed inside a raw field set is ignored — only the argument decides', () => {
    expect(
      formatDateWithTimezone(INSTANT, null, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Tokyo',
      }),
    ).toBe('Mar 20, 2026');
  });

  it('an unresolvable zone degrades to UTC instead of throwing', () => {
    expect(formatDateWithTimezone(INSTANT, 'Mars/Phobos')).toBe('Mar 20, 2026');
  });

  it('the viewer zone is available, and only when asked for', () => {
    const viewer = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(
      new Date(INSTANT),
    );
    expect(formatDateWithTimezone(INSTANT, VIEWER_TIMEZONE)).toBe(viewer);
  });

  it.each([null, undefined, '', 'not-a-date'])('an unusable value %j renders nothing, never "Invalid Date"', v => {
    expect(formatDateWithTimezone(v, null)).toBe('');
  });

  it('accepts an epoch number and a Date', () => {
    expect(formatDateWithTimezone(Date.parse(INSTANT), null)).toBe('Mar 20, 2026');
    expect(formatDateWithTimezone(new Date(INSTANT), null)).toBe('Mar 20, 2026');
  });
});

describe('presets render the shapes their callers print', () => {
  const INSTANT = '2026-03-20T01:18:00Z';
  it.each([
    ['medium', 'Mar 20, 2026'],
    ['long', 'March 20, 2026'],
    ['weekday', 'Friday, March 20'],
    ['numeric', '03/20/2026'],
    ['monthYear', 'March 2026'],
    ['monthYearShort', 'Mar 2026'],
    ['numericDateTime', '03/20/2026, 1:18 AM'],
    ['numericDateTime24h', '03/20/2026, 01:18'],
  ] as const)('%s → %s', (style, expected) => {
    expect(formatDateWithTimezone(INSTANT, null, style)).toBe(expected);
  });

  it('the clock is rendered by the same core, in the same zone', () => {
    expect(formatTimeWithTimezone(INSTANT, 'America/New_York')).toBe('9:18 PM');
    expect(formatTimeWithTimezone(INSTANT, 'America/New_York', { withZoneLabel: true })).toBe('9:18 PM EDT');
  });

  it('formatDateTimeYmd builds the sortable operator shape from the same formatter', () => {
    expect(formatDateTimeYmd('2026-03-20T00:05:00Z', null)).toBe('2026/03/20, 00:05');
    expect(formatDateTimeYmd('2026-03-20T00:05:00Z', null, { separator: ',' })).toBe('2026/03/20,00:05');
    // It used to print `NaN/NaN/NaN, NaN:NaN`.
    expect(formatDateTimeYmd('junk', null)).toBe('');
  });
});

describe('named helpers are presets over the core', () => {
  it('formatLegalDate states the calendar day, on any machine', () => {
    // It rendered with NO zone, so this read 02/28/2026 west of UTC.
    expect(formatLegalDate('2026-03-01')).toBe('03/01/2026');
    // ...and it threw on an unparseable value; it now renders nothing.
    expect(formatLegalDate('nope')).toBe('');
  });

  it('calendar-date presets render the day as written', () => {
    expect(formatReleaseDate('2025-11-11')).toBe('November 11, 2025');
    expect(formatDateShort('2025-11-11T23:30:00Z')).toBe('Nov 11, 2025');
    expect(formatDateSlashUTC('2025-11-11')).toBe('11/11/2025');
    // Unparseable input is returned as given, not reassembled into garbage.
    expect(formatReleaseDate('not-a-date')).toBe('not-a-date');
    expect(formatDateSlashUTC('not-a-date')).toBe('not-a-date');
  });

  it('the remaining helpers keep their shapes', () => {
    expect(formatDateUTC('2026-03-01')).toBe('Mar 1, 2026');
    expect(formatEntryMonthUTC('2026-03-01', 'long')).toBe('March 2026');
    expect(formatTicketFullTimestamp('2026-03-20T13:05:00Z')).toBe('03/20/2026, 1:05 PM');
    expect(formatTicketRelativeTime('2020-01-02T00:00:00Z')).toBe('01/02/2020');
    expect(formatAbsoluteDate('2026-03-20T01:18:00Z', { timeZone: 'America/New_York' })).toBe('Mar 19, 2026');
  });
});
