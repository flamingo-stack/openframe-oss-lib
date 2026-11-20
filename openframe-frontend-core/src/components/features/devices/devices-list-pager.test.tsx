import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CursorPagerFooterProps } from '../../../hooks/state/use-cursor-pager';
import { DevicesList, EMPTY_DEVICES_NARROWING } from './devices-list';

const DEVICE = { id: 'd-1', machineId: 'm-1', status: 'ONLINE', hostname: 'macbook-pro', nickname: null };

const PAGE_2: CursorPagerFooterProps = {
  hasNextPage: true,
  hasPreviousPage: true,
  isFirstPage: false,
  startCursor: 's2',
  endCursor: 'e2',
  rangeStart: 21,
  onNext: vi.fn(),
  onPrevious: vi.fn(),
  onFirst: vi.fn(),
};

function renderPage(isPending: boolean) {
  render(
    <DevicesList
      devices={[DEVICE]}
      narrowing={EMPTY_DEVICES_NARROWING}
      onNarrowingChange={() => {}}
      totalCount={40}
      pager={PAGE_2}
      isPending={isPending}
    />,
  );
}

describe('DevicesList pager', () => {
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
    expect(screen.getByText('21–21 of 40 devices')).toBeTruthy();
  });
});
