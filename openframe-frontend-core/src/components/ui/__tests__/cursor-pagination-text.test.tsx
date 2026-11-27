import { describe, expect, it } from 'vitest';
import { autoRefreshIntervalMs } from '../auto-refresh-control';
import { cursorPaginationText } from '../cursor-pagination';

describe('cursorPaginationText', () => {
  it('shows the range with the total, the range alone without one, and the count without a position', () => {
    expect(
      cursorPaginationText({
        currentCount: 20,
        totalCount: 340,
        hasNextPage: true,
        itemName: 'devices',
        rangeStart: 21,
      }),
    ).toBe('21–40 of 340 devices');
    expect(cursorPaginationText({ currentCount: 7, hasNextPage: false, itemName: 'logs', rangeStart: 41 })).toBe(
      '41–47 logs',
    );
    expect(cursorPaginationText({ currentCount: 20, totalCount: 340, hasNextPage: true, itemName: 'devices' })).toBe(
      'Showing 20 of 340 devices',
    );
    expect(
      cursorPaginationText({ currentCount: 0, hasNextPage: false, itemName: 'devices', rangeStart: 1 }),
    ).toBeNull();
  });
});

describe('autoRefreshIntervalMs', () => {
  it('reads seconds and minutes, and nothing else', () => {
    expect(autoRefreshIntervalMs('10s')).toBe(10_000);
    expect(autoRefreshIntervalMs('1m')).toBe(60_000);
    expect(autoRefreshIntervalMs('off')).toBeNull();
    expect(autoRefreshIntervalMs('0s')).toBeNull();
    expect(autoRefreshIntervalMs('5h')).toBeNull();
    expect(autoRefreshIntervalMs(null)).toBeNull();
  });
});
