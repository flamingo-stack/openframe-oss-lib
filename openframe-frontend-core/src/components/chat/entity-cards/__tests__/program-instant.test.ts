import { describe, expect, it } from 'vitest';

import { formatDateWithTimezone, formatTimeWithTimezone } from '../../../../utils/format';
import { programDateInstant } from '../program-instant';

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

  it('flags a calendar-date value so no clock is invented for it', () => {
    // An admin picks "Mar 19"; the picker stores UTC midnight. Rendering that
    // in a west-of-UTC zone would show Mar 18 at 8 PM.
    const r = programDateInstant({
      date: '2026-03-19T00:00:00.000Z',
      timezone: 'America/New_York',
      date_precision: 'date',
    });
    expect(r.dateOnly).toBe(true);
    // Callers render a dateOnly value UTC-pinned, which keeps the chosen day.
    expect(formatDateWithTimezone(r.instant, 'UTC')).toBe('Mar 19, 2026');
  });

  it('treats a real timestamp as an instant', () => {
    expect(programDateInstant(zoned).dateOnly).toBe(false);
  });
});
