import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { autoRefreshIntervalMs } from '../auto-refresh-control';
import { CursorPagination, cursorPaginationText } from '../cursor-pagination';

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

describe('CursorPagination', () => {
  it('draws First beside Previous with onFirst, and pages back without a start cursor', () => {
    const onFirst = vi.fn();
    const onPrevious = vi.fn();
    render(
      <CursorPagination
        hasNextPage
        hasPreviousPage
        isFirstPage={false}
        currentCount={20}
        rangeStart={41}
        onFirst={onFirst}
        onPrevious={onPrevious}
        onNext={vi.fn()}
        endCursor="ZA=="
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go to first page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to previous page' }));
    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledWith('');
    expect(screen.getByText('41–60 items')).toBeTruthy();
  });

  it('disables First on the first page and Previous without a previous page', () => {
    render(
      <CursorPagination
        hasNextPage
        hasPreviousPage={false}
        isFirstPage
        currentCount={20}
        onFirst={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Go to first page' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Go to previous page' }).disabled).toBe(true);
  });

  it('keeps the legacy onReset: First INSTEAD of Previous', () => {
    render(
      <CursorPagination
        hasNextPage
        hasPreviousPage
        isFirstPage={false}
        currentCount={5}
        onReset={vi.fn()}
        onPrevious={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Go to first page' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to previous page' })).toBeNull();
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
