import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CursorPagerFooterProps } from '../../../hooks/state/use-cursor-pager';
import { DevicesList, EMPTY_DEVICES_NARROWING } from './devices-list';

const DEVICE = { id: 'd-1', machineId: 'm-1', status: 'ONLINE', hostname: 'macbook-pro', nickname: null };

const PAGE_3: CursorPagerFooterProps = {
  hasNextPage: true,
  hasPreviousPage: true,
  isFirstPage: false,
  page: 3,
  startCursor: 's3',
  endCursor: 'e3',
  rangeStart: 41,
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onFirst: vi.fn(),
};

function renderPage(isPending: boolean) {
  return render(
    <DevicesList
      devices={[DEVICE]}
      narrowing={EMPTY_DEVICES_NARROWING}
      onNarrowingChange={() => {}}
      totalCount={60}
      metaRow={{ pager: PAGE_3, actions: <span>Refresh picker</span> }}
      isPending={isPending}
    />,
  );
}

describe('DevicesList pager', () => {
  it('sits in the row above the table, with the range in place of the count and the actions after it', () => {
    const { container, unmount } = renderPage(false);
    const html = container.innerHTML;
    unmount();
    const order = [
      'data-table-meta',
      '41–41 of 60 devices',
      'aria-label="Pagination"',
      'Refresh picker',
      'macbook-pro',
    ].map(mark => html.indexOf(mark));
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('pages while the rows on screen are the page it shows', () => {
    renderPage(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Go to next page' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Go to previous page' }).disabled).toBe(false);
  });

  it('waits while the next page is read, and keeps the count', () => {
    renderPage(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Go to next page' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Go to previous page' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Go to first page' }).disabled).toBe(true);
    expect(screen.getByText('41–41 of 60 devices')).toBeTruthy();
  });
});
