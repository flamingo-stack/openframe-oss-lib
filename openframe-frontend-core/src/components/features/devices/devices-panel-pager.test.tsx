import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CursorPagerFooterProps } from '../../../hooks/state/use-cursor-pager';
import { DevicesPanelView, type DevicesViewMode } from './devices-panel-view';
import type { DeviceRow } from './types';

const DEVICE: DeviceRow = { id: 'd-1', machineId: 'm-1', status: 'ONLINE', hostname: 'macbook-pro', nickname: null };

const PAGE_2: CursorPagerFooterProps = {
  hasNextPage: true,
  hasPreviousPage: true,
  isFirstPage: false,
  page: 2,
  startCursor: 's2',
  endCursor: 'e2',
  rangeStart: 21,
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onFirst: vi.fn(),
};

/** Rows the body drew (it marks every one, loading rows included). */
const rowCount = (html: string) => html.match(/data-loading-item/g)?.length ?? 0;

const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Go to next page' });

/** The marks appear in the page in this order. */
function inOrder(html: string, marks: string[]) {
  const order = marks.map(mark => html.indexOf(mark));
  expect(order.every(index => index >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
}

function renderPanel(viewMode: DevicesViewMode, props: Partial<Parameters<typeof DevicesPanelView>[0]> = {}) {
  return render(
    <DevicesPanelView
      viewMode={viewMode}
      devices={[DEVICE]}
      totalCount={340}
      hasNextPage
      onLoadMore={vi.fn()}
      metaRow={{ pager: PAGE_2, actions: <span>Refresh picker</span> }}
      {...props}
    />,
  );
}

describe('DevicesPanelView pager', () => {
  it.each<DevicesViewMode>(['table', 'grid'])(
    '%s view: the range and the pager sit in the row above the rows, the actions after them',
    viewMode => {
      const { container } = renderPanel(viewMode);
      inOrder(container.innerHTML, [
        'data-table-meta',
        '21–21 of 340 devices',
        'aria-label="Pagination"',
        'Refresh picker',
        'macbook-pro',
      ]);
      expect(nextButton().disabled).toBe(false);
    },
  );

  it('table view: draws no load-more footer on a paged list', () => {
    const { container, unmount } = renderPanel('table', { isFetchingNextPage: true });
    // Only the page's one row: no load-more skeleton rows under it.
    expect(rowCount(container.innerHTML)).toBe(1);
    unmount();
    // The same list read page after page draws the next page's skeleton rows.
    const view = renderPanel('table', { isFetchingNextPage: true, metaRow: undefined, pageSize: 5 });
    expect(rowCount(view.container.innerHTML)).toBeGreaterThan(1);
  });

  it('tiles view: no scroll sentinel and no count in the filter row, so the count is drawn once', () => {
    const sentinelRef = { current: null };
    const { container } = renderPanel('grid', { gridSentinelRef: sentinelRef });
    expect(sentinelRef.current).toBeNull();
    expect(container.innerHTML).not.toContain('340 results');
    expect(screen.getAllByText(/of 340 devices/)).toHaveLength(1);
  });

  it.each<DevicesViewMode>(['table', 'grid'])('%s view: the pager waits while a narrowing resolves', viewMode => {
    renderPanel(viewMode, { isNarrowing: true });
    expect(nextButton().disabled).toBe(true);
  });

  it('tiles view without a pager keeps the infinite list and its count in the filter row', () => {
    const sentinelRef = { current: null as HTMLDivElement | null };
    const { container } = renderPanel('grid', { metaRow: undefined, gridSentinelRef: sentinelRef });
    expect(container.innerHTML).not.toContain('data-table-meta');
    expect(sentinelRef.current).not.toBeNull();
  });

  it('an empty first page draws no pager', () => {
    renderPanel('table', {
      devices: [],
      totalCount: 0,
      metaRow: { pager: { ...PAGE_2, page: 1, isFirstPage: true, hasPreviousPage: false, rangeStart: 1 } },
    });
    expect(screen.queryByRole('button', { name: 'Go to next page' })).toBeNull();
  });
});
