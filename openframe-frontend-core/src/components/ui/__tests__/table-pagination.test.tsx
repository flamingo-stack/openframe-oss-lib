import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TABLE_PAGINATION_PENDING, TablePagination, type TablePagerState } from '../table-pagination';

const button = (name: string) => screen.queryByRole<HTMLButtonElement>('button', { name });
const first = () => button('Go to first page');
const previous = () => button('Go to previous page');
const next = () => button('Go to next page');
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

const handlers = () => ({ onFirst: vi.fn(), onPrevious: vi.fn(), onNext: vi.fn() });
/** A pager with its handlers, `overrides` on top. */
const pagerAt = (overrides: Partial<TablePagerState>): TablePagerState => ({
  hasNextPage: true,
  ...handlers(),
  ...overrides,
});

describe('TablePagination', () => {
  it('on page 1: Previous waits, Next pages on, and there is no First', () => {
    const pager = pagerAt({ hasPreviousPage: false, isFirstPage: true, page: 1, endCursor: 'e1' });
    render(<TablePagination pager={pager} />);

    expect(first()).toBeNull();
    expect(previous()?.disabled).toBe(true);
    expect(next()?.disabled).toBe(false);
    click('Go to next page');
    expect(pager.onNext).toHaveBeenCalledWith('e1');
  });

  it('on page 2: Previous goes back, still no First (Previous is the way to page 1)', () => {
    const pager = pagerAt({ hasPreviousPage: true, isFirstPage: false, page: 2, startCursor: 's2', endCursor: 'e2' });
    render(<TablePagination pager={pager} />);

    expect(first()).toBeNull();
    click('Go to previous page');
    expect(pager.onPrevious).toHaveBeenCalledWith('s2');
  });

  it('from page 3: the quiet First before Previous', () => {
    const pager = pagerAt({ hasPreviousPage: true, isFirstPage: false, page: 3, endCursor: 'e3' });
    render(<TablePagination pager={pager} />);

    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual([
      'Go to first page',
      'Go to previous page',
      'Go to next page',
    ]);
    click('Go to first page');
    expect(pager.onFirst).toHaveBeenCalledTimes(1);
  });

  it('draws First on a page whose index is unknown (a shared link with a cursor and no index)', () => {
    render(<TablePagination pager={pagerAt({ hasPreviousPage: false, isFirstPage: false })} />);
    expect(first()?.disabled).toBe(false);
    // No history and no server Previous: First is the way back.
    expect(previous()?.disabled).toBe(true);
  });

  it('pages back through history with no start cursor', () => {
    const pager = pagerAt({ hasNextPage: false, hasPreviousPage: true, isFirstPage: false, page: 4 });
    render(<TablePagination pager={pager} />);
    click('Go to previous page');
    expect(pager.onPrevious).toHaveBeenCalledWith('');
    expect(next()?.disabled).toBe(true);
  });

  it('waits while the page is read: every button disabled', () => {
    render(
      <TablePagination
        pager={pagerAt({ hasPreviousPage: true, isFirstPage: false, page: 3, endCursor: 'e' })}
        loading
      />,
    );
    expect([first(), previous(), next()].map(b => b?.disabled)).toEqual([true, true, true]);
  });

  it('draws a disabled arrow on the page ground, a live one on the card colour', () => {
    render(<TablePagination pager={pagerAt({ hasPreviousPage: false, isFirstPage: true, page: 1, endCursor: 'e' })} />);
    expect(previous()?.className).toContain('disabled:bg-ods-bg-base');
    expect(next()?.className).toContain('bg-ods-card');
  });

  it('has no rows-per-page menu unless asked for, then shows the current size', () => {
    const pager = pagerAt({ isFirstPage: true, page: 1 });
    const { rerender } = render(<TablePagination pager={pager} />);
    expect(screen.queryByText(/per page/)).toBeNull();

    rerender(<TablePagination pager={pager} rowsPerPage={{ pageSize: 50, onChange: vi.fn() }} />);
    expect(screen.getByRole('button', { name: 'Rows per page: 50' }).textContent).toContain('50 per page');
  });

  it('shows the first option as the size when the host names none', () => {
    render(<TablePagination pager={pagerAt({ page: 1 })} rowsPerPage={{ options: [25, 75], onChange: vi.fn() }} />);
    expect(screen.getByRole('button', { name: 'Rows per page: 25' })).toBeTruthy();
  });

  it('draws the pending pager of a first page still being read: both arrows waiting', () => {
    render(<TablePagination pager={TABLE_PAGINATION_PENDING} loading />);
    expect(first()).toBeNull();
    expect([previous()?.disabled, next()?.disabled]).toEqual([true, true]);
  });

  it('is a navigation landmark', () => {
    render(<TablePagination pager={pagerAt({ isFirstPage: true, page: 1 })} />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy();
  });
});
