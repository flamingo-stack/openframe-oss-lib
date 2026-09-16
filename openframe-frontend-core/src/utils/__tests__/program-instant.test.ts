import { describe, expect, it } from 'vitest';

import {
  formatDateWithTimezone,
  formatDurationCompact,
  formatProgramDate,
  formatProgramTimeRange,
  formatTimeWithTimezone,
  formatWebinarTimeMeta,
} from '../format';
import { programDateInstant, programMetaLine } from '../program-instant';

/**
 * The rule every program surface renders by. It lived as prose in two
 * components that "mirrored" each other, and they drifted: the public card was
 * fixed while the chat card kept rendering the date in the VIEWER's zone beside
 * a time in the EVENT's zone. One owner, pinned here.
 */
describe('programDateInstant', () => {
  const zoned = {
    date: '2026-03-20T01:18:00.000Z',
    start_at: '2026-03-20T01:18:00.000Z',
    timezone: 'America/New_York',
  };

  it('renders date and time from ONE instant in ONE zone', () => {
    const r = programDateInstant(zoned);
    expect(r.instant).toBe('2026-03-20T01:18:00.000Z');
    expect(r.timezone).toBe('America/New_York');
    // 01:18Z is 9:18 PM on the 19th in New York — both halves must say the 19th.
    expect(formatDateWithTimezone(r.instant, r.timezone)).toBe('Mar 19, 2026');
    expect(formatTimeWithTimezone(r.instant, r.timezone)).toBe('9:18 PM');
  });

  it('prefers item.date, so an admin display override moves the card', () => {
    // item.date is the host-resolved instant with the override already applied.
    const r = programDateInstant({ ...zoned, date: '2026-02-09T15:00:00.000Z' });
    expect(r.instant).toBe('2026-02-09T15:00:00.000Z');
  });

  it('falls back to start_at when the item carries no resolved date', () => {
    expect(programDateInstant({ start_at: '2026-03-20T01:18:00.000Z', timezone: 'America/New_York' }).instant).toBe(
      '2026-03-20T01:18:00.000Z',
    );
  });

  it('keeps the UTC pin when the row declares no zone (React #418)', () => {
    // Returning an instant here would let a caller render viewer-local, which
    // differs between server and client.
    expect(programDateInstant({ date: '2026-03-20T01:18:00.000Z' }).instant).toBeNull();
  });

  it('flags an admin display override — the shape a producer ACTUALLY emits', () => {
    // This is what the DAL hands over: the override column is timestamptz and
    // the route normalizes through toISOString(), so the value is a FULL
    // INSTANT. An earlier version of this test hand-built a bare `YYYY-MM-DD`
    // row that no producer can emit, which made it pass while the bug it named
    // stayed live.
    const r = programDateInstant({
      date: '2026-03-19T00:00:00.000Z',
      start_at: '2026-04-01T20:00:00.000Z',
      timezone: 'America/New_York',
      date_is_display_override: true,
    });
    expect(r.dateOnly).toBe(true);
    // The resolved value carries NO ZONE, so a consumer cannot render or label
    // one. Three surfaces had to remember that gate and two forgot; nulling it
    // makes the mistake unrepresentable rather than merely documented.
    expect(r.timezone).toBeNull();
    // The admin who asked for March 19 sees March 19 — not March 18 at 8 PM,
    // which is what a zoned render of UTC midnight gives.
    expect(formatProgramDate(r)).toBe('Mar 19, 2026');
    // ...and that is true precisely BECAUSE the zone was dropped: rendering the
    // same value in the row's declared zone still lands on the 18th.
    expect(formatDateWithTimezone(r.utcDate, 'America/New_York')).toBe('Mar 18, 2026');
  });

  it('renders the same shape whether or not the row declares a zone', () => {
    // The UTC fallback used to be a separate date-fns branch at each call site,
    // and it emitted a DIFFERENT SHAPE ("Thursday 19 March" vs "Thursday,
    // March 19"), so whether a row happened to carry a zone decided how its
    // headline read.
    const withZone = formatProgramDate(programDateInstant(zoned), 'weekday');
    const withoutZone = formatProgramDate(programDateInstant({ date: '2026-03-19T12:00:00.000Z' }), 'weekday');
    expect(withZone).toBe('Thursday, March 19');
    expect(withoutZone).toBe('Thursday, March 19');
  });

  it('treats a real timestamp as an instant', () => {
    expect(programDateInstant(zoned).dateOnly).toBe(false);
  });
});

/**
 * The compact meta line. The public card and the chat card built this
 * separately, under a comment saying the second "mirrors" the first — and it
 * drifted twice, each time only on the copy nobody was looking at.
 */
describe('programMetaLine', () => {
  const FMT = {
    date: (at: ReturnType<typeof programDateInstant>) => formatProgramDate(at, 'medium'),
    duration: formatDurationCompact,
    webinarMeta: (at: ReturnType<typeof programDateInstant>, o: { startAt: string | null; endAt: string | null }) =>
      formatWebinarTimeMeta(at, { ...o, withZoneLabel: true }),
  };

  it('a webinar: day, clock and duration, all from one instant', () => {
    const { line } = programMetaLine(
      {
        date: '2026-03-20T01:18:00.000Z',
        start_at: '2026-03-20T01:18:00.000Z',
        end_at: '2026-03-20T02:03:00.000Z',
        timezone: 'America/New_York',
      },
      'webinar',
      FMT,
    );
    expect(line).toBe('Mar 19, 2026 · 9:18 PM EDT · 45m');
  });

  it('an overridden webinar: the chosen day, no clock, no zone', () => {
    const { line } = programMetaLine(
      {
        date: '2026-01-05T00:00:00.000Z',
        start_at: '2026-03-20T01:18:00.000Z',
        end_at: '2026-03-20T02:03:00.000Z',
        timezone: 'America/New_York',
        date_is_display_override: true,
      },
      'webinar',
      FMT,
    );
    expect(line).toBe('Jan 5, 2026 · 45m');
  });

  it('a scheduled podcast does not present its stored duration as elapsed time', () => {
    const row = { date: '2026-03-20T01:18:00.000Z', duration_seconds: 1800 };
    expect(programMetaLine(row, 'podcast', FMT).typeMeta).not.toBeNull();
    expect(programMetaLine({ ...row, status: 'scheduled' }, 'podcast', FMT).typeMeta).toBeNull();
  });

  it('an event falls back to nothing rather than a blank separator', () => {
    const { line } = programMetaLine({ date: '2026-03-20T01:18:00.000Z', location_name: '   ' }, 'event', FMT);
    // No zone on this row, so the day is UTC-pinned (the React #418 rule) —
    // and a whitespace-only location contributes nothing at all.
    expect(line).toBe('Mar 20, 2026');
  });
});

describe('formatProgramTimeRange', () => {
  it('an end with no usable start says nothing, rather than showing a FINISH as a start', () => {
    const at = programDateInstant({ timezone: 'America/New_York' });
    expect(formatProgramTimeRange(at, { endAt: '2026-03-20T17:00:00Z' })).toBe('');
  });

  it('labels only the last clock of a range', () => {
    const at = programDateInstant({ date: '2026-03-20T13:00:00Z', timezone: 'America/New_York' });
    expect(formatProgramTimeRange(at, { endAt: '2026-03-20T17:00:00Z', withZoneLabel: true })).toBe(
      '9:00 AM - 1:00 PM EDT',
    );
  });
});
