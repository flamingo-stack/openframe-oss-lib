import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  earliestDeviceLocalDay,
  fromScheduleInstant,
  getTimeSlotOptions,
  isScheduleStartInPast,
  isSlotOnGrid,
  SCHEDULE_TIME_REFERENCE,
  startOfToday,
} from '../scripts';

/**
 * The Time dropdown's option list, pinned around the one condition the form
 * branches on: an EMPTY list.
 *
 * `ScheduleTimingFields` reads emptiness as "today, and its last slot has gone
 * by" and puts `NO_SLOTS_TODAY_MESSAGE` on the Date field off the back of it. So
 * the cases below are not really about counting slots — they are about the three
 * other days that must never produce an empty list, because each of them would
 * turn that message into a lie.
 *
 * Times are built from LOCAL components (`new Date(y, m, d, h, min)`), never
 * from a UTC string: the slot grid is local by construction (see
 * `slotBaseMinutes`), so a fixed instant would test a different hour of the day
 * in every timezone CI happens to run in.
 */
describe('getTimeSlotOptions', () => {
  const day = { year: 2026, month: 0, date: 15 } as const;

  function freezeAt(hours: number, minutes: number): void {
    vi.setSystemTime(new Date(day.year, day.month, day.date, hours, minutes));
  }

  const today = () => new Date(day.year, day.month, day.date);

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('empties today once the last slot has gone by — the dead end the form names', () => {
    // 23:59 is past the last slot on every grid the offsets produce (23:30 on a
    // whole-hour zone, 23:45 on a 45-minute one).
    freezeAt(23, 59);
    expect(getTimeSlotOptions(today())).toEqual([]);
  });

  it('keeps today usable while slots remain, offering only the ones still ahead', () => {
    freezeAt(12, 0);
    const slots = getTimeSlotOptions(today());
    expect(slots.length).toBeGreaterThan(0);
    // Every option is later than now, which is what makes the list saveable.
    expect(slots.every(slot => slot.value > '12:00')).toBe(true);
  });

  it('keeps the full day for a LATER day, even at one minute to midnight', () => {
    freezeAt(23, 59);
    const tomorrow = new Date(day.year, day.month, day.date + 1);
    expect(getTimeSlotOptions(tomorrow)).toHaveLength(48);
  });

  it('keeps the full day for a PAST day, so a stored start stays readable', () => {
    freezeAt(23, 59);
    const yesterday = new Date(day.year, day.month, day.date - 1);
    expect(getTimeSlotOptions(yesterday)).toHaveLength(48);
  });

  it('keeps the full day when no date is picked yet', () => {
    freezeAt(23, 59);
    expect(getTimeSlotOptions(null)).toHaveLength(48);
    expect(getTimeSlotOptions()).toHaveLength(48);
  });

  it('offers the plain half-hour grid for a device-local start, in any zone', () => {
    freezeAt(0, 0);
    const tomorrow = new Date(day.year, day.month, day.date + 1);
    const slots = getTimeSlotOptions(tomorrow, SCHEDULE_TIME_REFERENCE.DEVICE_LOCAL);
    // The digits themselves are what gets stored, so they — not the instant they
    // would name — have to sit on the backend's boundary. In a 45-minute zone
    // this is the grid the SERVER reading cannot use, and vice versa.
    expect(slots).toHaveLength(48);
    expect(slots.every(slot => slot.value.endsWith(':00') || slot.value.endsWith(':30'))).toBe(true);
  });

  it('keeps every slot of TODAY for a device-local start, however late it is here', () => {
    // The case the SERVER reading empties. A wall clock is not the viewer's
    // moment: at 23:59 for the author, 8:00 AM is still hours ahead for every
    // device west of them, so withholding it would hide a working schedule
    // behind where the admin happens to sit.
    freezeAt(23, 59);
    expect(getTimeSlotOptions(today(), SCHEDULE_TIME_REFERENCE.DEVICE_LOCAL)).toHaveLength(48);
  });
});

/**
 * The two bounds a device-local start is still held to — and the one it is not.
 *
 * The fleet's clocks span 26 hours (UTC−12 … UTC+14), so "in the past" is not
 * the viewer's to judge per SLOT; it is only decidable per DAY, and only against
 * the westernmost clock on Earth.
 */
describe('device-local bounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never calls a device-local pair past, even a full day behind the viewer', () => {
    vi.setSystemTime(new Date(2026, 0, 15, 23, 59));
    const yesterday = new Date(2026, 0, 14);
    expect(isScheduleStartInPast(yesterday, '08:00', SCHEDULE_TIME_REFERENCE.DEVICE_LOCAL)).toBe(false);
    // The SERVER reading is unchanged: there the pair IS an instant, and it has gone.
    expect(isScheduleStartInPast(yesterday, '08:00', SCHEDULE_TIME_REFERENCE.SERVER)).toBe(true);
  });

  it('offers every day that is TODAY somewhere — a UTC+14 author can pick a UTC−12 device day', () => {
    // 00:30 on a UTC+14 clock, which is the worst case in the whole 26-hour
    // spread: the UTC−12 clock is then still on 14 Jan while the author's own
    // calendar has already turned 16 Jan. A floor built from the author's today
    // would refuse two days that are perfectly live for part of the fleet.
    vi.setSystemTime(new Date('2026-01-15T10:30:00Z'));
    const floor = earliestDeviceLocalDay();
    const floorDay = Date.UTC(floor.getFullYear(), floor.getMonth(), floor.getDate());
    expect(floorDay).toBe(Date.UTC(2026, 0, 14));

    // The property that matters, stated over the whole span rather than the one
    // zone: no clock on Earth is currently living in a day this bound refuses.
    // Compared as UTC-normalised days so the run's own timezone (and its DST)
    // cannot decide the outcome.
    for (let offset = -12; offset <= 14; offset++) {
      const at = new Date(Date.now() + offset * 60 * 60 * 1000);
      const dayThere = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
      expect(dayThere).toBeGreaterThanOrEqual(floorDay);
    }
  });

  it('floors the calendar at the westernmost clock, never later than the viewer own day', () => {
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0));
    const floor = earliestDeviceLocalDay();
    // Never later than the viewer's own today — a floor that cut into the day
    // they are looking at would refuse a start that is still hours away for
    // devices west of them.
    expect(floor.getTime()).toBeLessThanOrEqual(startOfToday().getTime());
    // And never further back than the 26-hour spread can justify: the UTC−12
    // clock is at most two calendar days behind a UTC+14 viewer, and anything
    // beyond that is a day no device on Earth can still reach.
    expect(startOfToday().getTime() - floor.getTime()).toBeLessThanOrEqual(2 * 24 * 60 * 60 * 1000);
  });
});

/**
 * The wall-clock reading, on the way back in.
 *
 * A DEVICE_LOCAL start stores a reading each device re-bases into its own zone,
 * so the digits are the payload. Every assertion is on local components, and
 * none of them depends on the timezone the tests run in.
 */
describe('device-local readings', () => {
  it('reads a stored wall clock back as the same reading', () => {
    const restored = fromScheduleInstant('2026-09-10T09:00:00Z', SCHEDULE_TIME_REFERENCE.DEVICE_LOCAL);
    expect([restored.getFullYear(), restored.getMonth(), restored.getDate()]).toEqual([2026, 8, 10]);
    expect([restored.getHours(), restored.getMinutes()]).toEqual([9, 0]);
  });

  it('reads a SERVER start as the instant it names', () => {
    const picked = new Date(2026, 8, 10, 9, 0);
    expect(fromScheduleInstant(picked.toISOString(), SCHEDULE_TIME_REFERENCE.SERVER).getTime()).toBe(picked.getTime());
  });

  it('grades a slot against the grid its own reading uses', () => {
    expect(isSlotOnGrid('09:30', SCHEDULE_TIME_REFERENCE.DEVICE_LOCAL)).toBe(true);
    // Which is what the Timezone control checks before keeping a picked time: a
    // 45-minute zone's SERVER slots read xx:15 / xx:45 and cannot survive the
    // switch.
    expect(isSlotOnGrid('09:15', SCHEDULE_TIME_REFERENCE.DEVICE_LOCAL)).toBe(false);
  });
});
