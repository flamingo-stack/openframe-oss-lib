import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CursorPagerFooterProps } from '../../hooks/state/use-cursor-pager';
import { SingleCustomerTenantsTableView } from './cloud-tenants/single-customer-tenants-table-view';
import { TenantsTableView } from './cloud-tenants/tenants-table-view';
import { LOGS_TABLE, POLICIES_TABLE, SINGLE_CUSTOMER_TENANTS_TABLE, TENANTS_TABLE } from './feature-tables.fixtures';
import { LogsTableView } from './logs/logs-table-view';
import { PoliciesTable } from './policies/policies-table';

const pager = (overrides: Partial<CursorPagerFooterProps> = {}): CursorPagerFooterProps => ({
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
  ...overrides,
});

const nextButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Go to next page' });

/** Rows the body drew (it marks every one, loading rows included). */
const rowCount = (html: string) => html.match(/data-loading-item/g)?.length ?? 0;

/** The marks appear in the page in this order. */
function inOrder(html: string, marks: string[]) {
  const order = marks.map(mark => html.indexOf(mark));
  expect(order.every(index => index >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
}

describe('LogsTableView pager', () => {
  it('puts the range (no total: logs carry none) and the pager in the row above the table, then the actions', () => {
    const { container } = render(
      <LogsTableView {...LOGS_TABLE.loaded} metaRow={{ pager: pager(), actions: <span>Refresh picker</span> }} />,
    );
    inOrder(container.innerHTML, ['data-table-meta', '21–22 logs', 'aria-label="Pagination"', 'Refresh picker']);
    expect(nextButton().disabled).toBe(false);
  });

  it('draws no load-more footer on a paged list', () => {
    const { container } = render(
      <LogsTableView {...LOGS_TABLE.loaded} isFetchingNextPage metaRow={{ pager: pager() }} />,
    );
    // Only the page's two rows: no load-more skeleton rows under them.
    expect(rowCount(container.innerHTML)).toBe(2);
  });

  it('keeps an empty later page and its pager instead of the "no logs yet" panel', () => {
    render(<LogsTableView logs={[]} filters={{}} onFilterChange={() => {}} metaRow={{ pager: pager({ page: 3 }) }} />);
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toBeTruthy();
    expect(screen.queryByText('Track who did what, when, and on which device')).toBeNull();
  });

  it('waits while the next page is read', () => {
    render(<LogsTableView {...LOGS_TABLE.loaded} metaRow={{ pager: pager(), loading: true }} />);
    expect(nextButton().disabled).toBe(true);
  });

  it('keeps the count in the card header with no pager and no actions', () => {
    const { container } = render(<LogsTableView {...LOGS_TABLE.loaded} hasNextPage={false} />);
    expect(container.innerHTML).not.toContain('data-table-meta');
  });
});

describe('TenantsTableView pager', () => {
  it('shows the range with the total on the multi-customer list, and no load-more footer', () => {
    const { container } = render(
      <TenantsTableView
        {...TENANTS_TABLE.loaded}
        totalCount={120}
        isFetchingNextPage
        metaRow={{ pager: pager(), actions: <span>Refresh picker</span> }}
      />,
    );
    inOrder(container.innerHTML, [
      'data-table-meta',
      '21–22 of 120 results',
      'aria-label="Pagination"',
      'Refresh picker',
    ]);
    // Only the page's two rows: no load-more skeleton rows under them.
    expect(rowCount(container.innerHTML)).toBe(2);
  });

  it('shows the range with the total on the single-customer list', () => {
    render(
      <SingleCustomerTenantsTableView
        {...SINGLE_CUSTOMER_TENANTS_TABLE.loaded}
        totalCount={120}
        metaRow={{ pager: pager() }}
      />,
    );
    expect(screen.getByText('21–22 of 120 results')).toBeTruthy();
  });

  it('waits while a deferred page is pending, and keeps the range', () => {
    render(<TenantsTableView {...TENANTS_TABLE.loaded} totalCount={120} isPending metaRow={{ pager: pager() }} />);
    expect(nextButton().disabled).toBe(true);
    expect(screen.getByText('21–22 of 120 results')).toBeTruthy();
  });
});

describe('PoliciesTable actions', () => {
  it('draws the row above the table in the card layout, with the count on its left and the actions on its right', () => {
    const { container } = render(<PoliciesTable {...POLICIES_TABLE.loaded} actions={<span>Refresh picker</span>} />);
    inOrder(container.innerHTML, ['data-table-meta', '2 policies', 'Refresh picker', 'Disk encryption enabled']);
    expect(screen.getAllByText('2 policies')).toHaveLength(1);
  });

  it('keeps the count in the card header without actions', () => {
    const { container } = render(<PoliciesTable {...POLICIES_TABLE.loaded} />);
    expect(container.innerHTML).not.toContain('data-table-meta');
  });
});
