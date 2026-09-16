import { describe, expect, it } from 'vitest';

import {
  formatDateWithTimezone,
  formatDurationFromRange,
  formatTimeWithTimezone,
  formatWebinarTimeMeta,
} from '../format';

/**
 * These three formatters render the date, time and duration of ONE event, side
 * by side on the program card. They had no coverage at all, which is how a
 * missing sign guard shipped: a live webinar row whose `end_at` preceded its
 * `start_at` printed "-45m" on the card.
 */
describe('formatDurationFromRange', () => {
  it('formats a positive range', () => {
    expect(formatDurationFromRange('2026-03-20T00:00:00Z', '2026-03-20T00:45:00Z')).toBe('45m');
    expect(formatDurationFromRange('2026-03-20T00:00:00Z', '2026-03-20T01:30:00Z')).toBe('1h 30m');
    expect(formatDurationFromRange('2026-03-20T00:00:00Z', '2026-03-20T02:00:00Z')).toBe('2h');
  });

  it('renders NOTHING when the event ends before it starts', () => {
    // The live row that produced the bug report: e6cff6f8, end_at 45 minutes
    // before start_at. It used to render "-45m" — and note that a -90 minute
    // range never reached the `>= 60` branch, so it printed "-90m" rather than
    // "-1h 30m": the output was not merely wrong, it was inconsistently wrong.
    expect(formatDurationFromRange('2026-03-20T00:00:00Z', '2026-03-19T23:15:25Z')).toBe('');
    expect(formatDurationFromRange('2026-03-20T02:00:00Z', '2026-03-20T00:30:00Z')).toBe('');
  });

  it('renders nothing for a zero-length or unparseable range', () => {
    expect(formatDurationFromRange('2026-03-20T00:00:00Z', '2026-03-20T00:00:00Z')).toBe('');
    // Used to print the literal string "NaNm".
    expect(formatDurationFromRange('not-a-date', '2026-03-20T00:00:00Z')).toBe('');
    expect(formatDurationFromRange('2026-03-20T00:00:00Z', 'not-a-date')).toBe('');
  });

  it('renders nothing when an endpoint is missing', () => {
    expect(formatDurationFromRange(null, '2026-03-20T00:00:00Z')).toBe('');
    expect(formatDurationFromRange('2026-03-20T00:00:00Z', undefined)).toBe('');
  });
});

describe('formatDateWithTimezone / formatTimeWithTimezone agree on the zone', () => {
  // The reported defect: the card printed the date in UTC and the time beside
  // it in the event's own zone, so this instant read "Mar 20, 2026 · 9:18 PM"
  // — 9:18 PM on the 20th is not when it happens, 9:18 PM on the 19th is.
  const instant = '2026-03-20T01:18:00Z';
  const zone = 'America/New_York';

  it('puts the date on the event-local day, not the UTC day', () => {
    expect(formatDateWithTimezone(instant, zone)).toBe('Mar 19, 2026');
    expect(formatTimeWithTimezone(instant, zone)).toBe('9:18 PM');
  });

  it('renders the weekday style in the same zone', () => {
    // Note the copy shift: the default density used to build this from the
    // date-fns pattern 'EEEE d MMMM' ("Thursday 19 March"). Intl's en-US order
    // is "Thursday, March 19". Preserving the old wording would mean composing
    // the string from Intl parts by hand — re-introducing exactly the bespoke
    // date arithmetic this change exists to remove — so the locale-correct
    // form wins, consistent with every other formatter in this file.
    expect(formatDateWithTimezone(instant, zone, 'weekday')).toBe('Thursday, March 19');
  });

  it('falls back to UTC on both halves when no zone is given', () => {
    expect(formatDateWithTimezone(instant, null)).toBe('Mar 20, 2026');
    expect(formatTimeWithTimezone(instant, null)).toBe('1:18 AM');
  });

  it('handles a legacy fixed-offset label consistently across both halves', () => {
    // "EST" does NOT throw — Node resolves it as a legacy fixed UTC-5 alias, so
    // it lands on the 19th at 8:18 PM (no DST, unlike America/New_York's EDT).
    // What matters is that the date and the time agree about the zone.
    expect(formatDateWithTimezone(instant, 'EST')).toBe('Mar 19, 2026');
    expect(formatTimeWithTimezone(instant, 'EST')).toBe('8:18 PM');
  });

  it('degrades BOTH halves to UTC on a genuinely invalid zone', () => {
    // A label Intl cannot resolve DOES throw a RangeError. Both formatters must
    // catch it the same way, or the pair disagrees about which zone it used.
    expect(formatDateWithTimezone(instant, 'Not/AZone')).toBe('Mar 20, 2026');
    expect(formatTimeWithTimezone(instant, 'Not/AZone')).toBe('1:18 AM');
  });

  it('appends the zone label only when asked', () => {
    expect(formatTimeWithTimezone(instant, zone, { withZoneLabel: true })).toBe('9:18 PM EDT');
  });

  it('renders nothing for a missing or unparseable date', () => {
    expect(formatDateWithTimezone(null, zone)).toBe('');
    expect(formatDateWithTimezone('not-a-date', zone)).toBe('');
    expect(formatTimeWithTimezone('not-a-date', zone)).toBe('');
  });
});

/**
 * The webinar time+duration composition. These exact three lines existed in
 * three surfaces and drifted twice — once so the page read the raw `start_at`
 * while the card read the resolved instant, once so two of three applied the
 * display-override rule. The rule now lives here, so it is tested here.
 */
describe('formatWebinarTimeMeta', () => {
  const base = { startAt: '2026-03-20T01:18:00Z', endAt: '2026-03-20T02:18:00Z', timezone: 'America/New_York' };

  it('renders the time from the resolved instant and the duration from the range', () => {
    expect(formatWebinarTimeMeta({ ...base, instant: base.startAt })).toBe('9:18 PM · 1h');
  });

  it('labels the zone when asked', () => {
    expect(formatWebinarTimeMeta({ ...base, instant: base.startAt, withZoneLabel: true })).toBe('9:18 PM EDT · 1h');
  });

  it('drops the CLOCK for a display override, keeping the duration', () => {
    // A chosen display date has no time of day the admin meant.
    expect(formatWebinarTimeMeta({ ...base, instant: '2026-03-19T00:00:00Z', dateOnly: true })).toBe('1h');
  });

  it('leaves no dangling separator when either side is missing', () => {
    expect(formatWebinarTimeMeta({ ...base, endAt: null, instant: base.startAt })).toBe('9:18 PM');
    // An inverted range yields no duration — and must not leave a trailing " · ".
    expect(formatWebinarTimeMeta({ ...base, endAt: '2026-03-20T00:00:00Z', instant: base.startAt })).toBe('9:18 PM');
    // An unrenderable time must not leave a LEADING " · " either.
    expect(formatWebinarTimeMeta({ ...base, instant: 'not-a-date' })).toBe('1h');
  });

  it('falls back to start_at when no resolved instant is supplied', () => {
    expect(formatWebinarTimeMeta({ ...base, instant: null })).toBe('9:18 PM · 1h');
  });
});
