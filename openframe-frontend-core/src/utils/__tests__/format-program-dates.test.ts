import { describe, expect, it } from 'vitest';

import {
  formatDateWithTimezone,
  formatDurationFromRange,
  formatProgramDate,
  formatTimeWithTimezone,
  formatWebinarTimeMeta,
} from '../format';
import { programDateInstant } from '../program-instant';

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
  const RANGE = { startAt: '2026-03-20T01:18:00Z', endAt: '2026-03-20T02:18:00Z' };
  // Built through the resolver, never hand-assembled: the helper takes the
  // RESOLVED value precisely so a caller cannot invent a combination the
  // resolver would never produce (which is how four call sites disagreed).
  const zonedRow = { date: RANGE.startAt, start_at: RANGE.startAt, timezone: 'America/New_York' };

  it('renders the time from the resolved instant and the duration from the range', () => {
    expect(formatWebinarTimeMeta(programDateInstant(zonedRow), RANGE)).toBe('9:18 PM · 1h');
  });

  it('labels the zone when asked', () => {
    expect(formatWebinarTimeMeta(programDateInstant(zonedRow), { ...RANGE, withZoneLabel: true })).toBe(
      '9:18 PM EDT · 1h',
    );
  });

  it('drops the CLOCK for a display override, keeping the duration', () => {
    // A chosen display date has no time of day the admin meant.
    const at = programDateInstant({ ...zonedRow, date: '2026-03-19T00:00:00Z', date_is_display_override: true });
    expect(formatWebinarTimeMeta(at, RANGE)).toBe('1h');
  });

  it('leaves no dangling separator when either side is missing', () => {
    const at = programDateInstant(zonedRow);
    expect(formatWebinarTimeMeta(at, { ...RANGE, endAt: null })).toBe('9:18 PM');
    // An inverted range yields no duration — and must not leave a trailing " · ".
    expect(formatWebinarTimeMeta(at, { ...RANGE, endAt: '2026-03-20T00:00:00Z' })).toBe('9:18 PM');
    // An unrenderable time must not leave a LEADING " · " either.
    expect(
      formatWebinarTimeMeta(programDateInstant({ ...zonedRow, date: 'not-a-date', start_at: 'not-a-date' }), RANGE),
    ).toBe('1h');
  });

  it('a zoneless row still renders a deterministic UTC clock, not nothing', () => {
    // `instant` is null without a zone (the React #418 pin), so the helper must
    // fall through to the canonical value rather than dropping the time.
    const at = programDateInstant({ date: RANGE.startAt, start_at: RANGE.startAt });
    expect(at.instant).toBeNull();
    expect(formatWebinarTimeMeta(at, RANGE)).toBe('1:18 AM · 1h');
  });

  it('the two compact surfaces that mirror each other label the zone alike', () => {
    // They took `withZoneLabel` from different expressions, so a zoneless
    // webinar read "1:18 AM UTC" on the public card and "1:18 AM" on the chat
    // card — for one row, on two cards built to look the same.
    const at = programDateInstant({ date: RANGE.startAt, start_at: RANGE.startAt });
    expect(formatWebinarTimeMeta(at, { ...RANGE, withZoneLabel: true })).toBe('1:18 AM UTC · 1h');
  });
});

describe('a day-valued row leaves nothing for a consumer to mislabel', () => {
  // The worst shape this rule can produce, and the one three surfaces rendered:
  // an override supplies the day (so no clock), `end_at` is null (so no
  // duration), and the composition is EMPTY — beside which two of the three
  // surfaces still printed the row's bare IANA zone, captioning nothing.
  //
  // `end_at` being null is not hypothetical: the Livestorm ingest guard nulls
  // it on an inverted range, which is exactly the corrupt-row case that guard
  // was added for.
  it('empty meta and no zone, so the slot renders nothing at all', () => {
    const at = programDateInstant({
      date: '2026-03-19T00:00:00.000Z',
      start_at: '2026-03-20T01:18:00.000Z',
      timezone: 'America/New_York',
      date_is_display_override: true,
    });
    expect(at.timezone).toBeNull();
    expect(formatWebinarTimeMeta(at, { startAt: '2026-03-20T01:18:00.000Z', endAt: null, withZoneLabel: true })).toBe(
      '',
    );
    // ...while the DATE is still stated, and states the day the admin chose.
    expect(formatProgramDate(at, 'weekday')).toBe('Thursday, March 19');
  });
});
