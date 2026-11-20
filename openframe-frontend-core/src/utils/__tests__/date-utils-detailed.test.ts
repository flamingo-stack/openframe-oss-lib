import { describe, expect, it } from 'vitest';
import { getDetailedTimeDifferenceFrom } from '../date-utils';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('getDetailedTimeDifferenceFrom', () => {
  it('reads under a minute, and a time in the future, as just now', () => {
    expect(getDetailedTimeDifferenceFrom(ago(0), NOW)).toBe('just now');
    expect(getDetailedTimeDifferenceFrom(ago(59_000), NOW)).toBe('just now');
    expect(getDetailedTimeDifferenceFrom(ago(-3 * MIN), NOW)).toBe('just now');
  });

  it('says one unit in the singular and more in the plural', () => {
    expect(getDetailedTimeDifferenceFrom(ago(MIN), NOW)).toBe('1 minute ago');
    expect(getDetailedTimeDifferenceFrom(ago(5 * MIN), NOW)).toBe('5 minutes ago');
    expect(getDetailedTimeDifferenceFrom(ago(HOUR), NOW)).toBe('1 hour ago');
    expect(getDetailedTimeDifferenceFrom(ago(23 * HOUR), NOW)).toBe('23 hours ago');
    expect(getDetailedTimeDifferenceFrom(ago(DAY), NOW)).toBe('1 day ago');
    expect(getDetailedTimeDifferenceFrom(ago(2 * DAY), NOW)).toBe('2 days ago');
    expect(getDetailedTimeDifferenceFrom(ago(30 * DAY), NOW)).toBe('1 month ago');
    expect(getDetailedTimeDifferenceFrom(ago(90 * DAY), NOW)).toBe('3 months ago');
    expect(getDetailedTimeDifferenceFrom(ago(365 * DAY), NOW)).toBe('1 year ago');
    expect(getDetailedTimeDifferenceFrom(ago(800 * DAY), NOW)).toBe('2 years ago');
  });

  it('stays in months just short of a year, never "0 years ago"', () => {
    expect(getDetailedTimeDifferenceFrom(ago(362 * DAY), NOW)).toBe('12 months ago');
    expect(getDetailedTimeDifferenceFrom(ago(364 * DAY), NOW)).toBe('12 months ago');
  });

  it('takes the clock as a Date too, and reports an unreadable timestamp', () => {
    expect(getDetailedTimeDifferenceFrom(ago(2 * DAY), new Date(NOW))).toBe('2 days ago');
    expect(getDetailedTimeDifferenceFrom('not a date', NOW)).toBe('Invalid date');
  });
});
