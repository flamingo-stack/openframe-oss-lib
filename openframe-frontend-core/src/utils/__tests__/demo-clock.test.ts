import { describe, expect, it } from 'vitest';
import { demoClockTimes, formatDemoClock } from '../demo-clock';

const toMinutes = (label: string): number => {
  const [, hour, minute, half] = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label) ?? [];
  return ((Number(hour) % 12) + (half === 'PM' ? 12 : 0)) * 60 + Number(minute);
};

describe('demo clock', () => {
  it('formats minutes of the day on a 12-hour clock', () => {
    expect(formatDemoClock(0)).toBe('12:00 AM');
    expect(formatDemoClock(9 * 60 + 2)).toBe('9:02 AM');
    expect(formatDemoClock(12 * 60)).toBe('12:00 PM');
    expect(formatDemoClock(14 * 60 + 47)).toBe('2:47 PM');
    expect(formatDemoClock(24 * 60 + 5)).toBe('12:05 AM');
  });

  it('gives the same times for the same seed', () => {
    expect(demoClockTimes('card-1', { count: 3 })).toEqual(demoClockTimes('card-1', { count: 3 }));
  });

  it('gives different seeds different times', () => {
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => demoClockTimes(`card-${i}`)[0]));
    expect(firsts.size).toBeGreaterThan(10);
  });

  it('starts inside the working day and never goes back in time', () => {
    for (let i = 0; i < 50; i++) {
      const times = demoClockTimes(`seed-${i}`, { count: 4 }).map(toMinutes);
      expect(times[0]).toBeGreaterThanOrEqual(8 * 60);
      expect(times[0]).toBeLessThan(18 * 60);
      for (let turn = 1; turn < times.length; turn++) {
        expect(times[turn]).toBeGreaterThanOrEqual(times[turn - 1]);
        expect(times[turn] - times[turn - 1]).toBeLessThanOrEqual(3);
      }
    }
  });

  it('returns one time per turn asked for', () => {
    expect(demoClockTimes('x', { count: 0 })).toEqual([]);
    expect(demoClockTimes('x')).toHaveLength(2);
  });
});
