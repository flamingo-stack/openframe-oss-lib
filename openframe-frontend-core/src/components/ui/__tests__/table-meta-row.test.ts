import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUTO_REFRESH_OPTIONS } from '../auto-refresh-control';
import { tableMetaRowLayout } from '../data-table/data-table-meta-row';
import type { TablePagerState } from '../table-pagination';

const PAGE: TablePagerState = { hasNextPage: true, onNext: vi.fn(), onPrevious: vi.fn() };

describe('tableMetaRowLayout', () => {
  it('pages a list with rows, and draws the row for it', () => {
    expect(tableMetaRowLayout({ pager: { ...PAGE, page: 1 } }, { rowCount: 20 })).toEqual({ paged: true, drawn: true });
  });

  it('draws no pager for an empty first page: the empty state is the whole answer', () => {
    expect(tableMetaRowLayout({ pager: { ...PAGE, page: 1 } }, { rowCount: 0 })).toEqual({
      paged: false,
      drawn: false,
    });
  });

  it('keeps the pager on an empty later page, so the way back stays', () => {
    expect(tableMetaRowLayout({ pager: { ...PAGE, page: 3 } }, { rowCount: 0 }).paged).toBe(true);
  });

  it('keeps the pager while the first page is read (pager null) or the next one is', () => {
    expect(tableMetaRowLayout({ pager: null }, { rowCount: 0 }).paged).toBe(true);
    expect(tableMetaRowLayout({ pager: { ...PAGE, page: 1 }, loading: true }, { rowCount: 0 }).paged).toBe(true);
  });

  it('draws the row for the actions alone, or a grid count, but not over a hidden header', () => {
    expect(tableMetaRowLayout({ actions: 'picker' }, { rowCount: 3 })).toEqual({ paged: false, drawn: true });
    expect(tableMetaRowLayout(undefined, { rowCount: 3, grid: true }).drawn).toBe(true);
    expect(tableMetaRowLayout(undefined, { rowCount: 3 }).drawn).toBe(false);
    expect(tableMetaRowLayout({ actions: 'picker' }, { rowCount: 0, showHeader: false }).drawn).toBe(false);
  });
});

describe('DEFAULT_AUTO_REFRESH_OPTIONS', () => {
  it('offers off, 10 s, 30 s, 1 min and 5 min', () => {
    expect(DEFAULT_AUTO_REFRESH_OPTIONS.map(option => option.value)).toEqual(['off', '10s', '30s', '1m', '5m']);
  });
});
