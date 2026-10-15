import { createColumnHelper } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../components/ui/data-table';
import { useDataTable } from '../components/ui/data-table/use-data-table';

/**
 * A loading table is ONE announcement: the body's region ("Loading results") while the first page loads,
 * the footer's "Loading more results" while a next page does. The skeleton rows and their bars are hidden.
 */

interface Row {
  id: string;
  name: string;
}

const columnHelper = createColumnHelper<Row>();
const columns = [columnHelper.accessor('name', { id: 'name', header: 'Name' })];
const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Row ${i}` }));
const noop = () => undefined;

function Table({
  data,
  loading = false,
  isFetchingNextPage = false,
  loadingRegion,
}: {
  data: Row[];
  loading?: boolean;
  isFetchingNextPage?: boolean;
  loadingRegion?: boolean;
}) {
  const table = useDataTable({ data, columns });
  return (
    <DataTable table={table}>
      <DataTable.Body<Row> loading={loading} skeletonRows={3} loadingRegion={loadingRegion} />
      <DataTable.InfiniteFooter
        hasNextPage={false}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={noop}
        skeletonRows={2}
      />
    </DataTable>
  );
}

const busyCount = (container: HTMLElement) => container.innerHTML.split('aria-busy="true"').length - 1;

describe('DataTable loading accessibility', () => {
  it('announces the first page once and marks the body busy', () => {
    const { container } = render(<Table data={[]} loading />);
    const statuses = screen.getAllByRole('status').filter(status => status.textContent !== '');
    expect(statuses.map(status => status.textContent)).toEqual(['Loading results']);
    expect(busyCount(container)).toBe(1);
  });

  it('leaves the announcement to an outer region when loadingRegion is false', () => {
    const { container } = render(<Table data={[]} loading loadingRegion={false} />);
    expect(screen.getAllByRole('status').filter(status => status.textContent !== '')).toHaveLength(0);
    expect(busyCount(container)).toBe(0);
  });

  it('announces a next page once, through the footer', () => {
    render(<Table data={[]} isFetchingNextPage />);
    const statuses = screen.getAllByRole('status').filter(status => status.textContent !== '');
    expect(statuses.map(status => status.textContent)).toEqual(['Loading more results']);
  });

  it('announces a next page drawn inside the body once', () => {
    render(<Table data={rows(2)} isFetchingNextPage />);
    const statuses = screen.getAllByRole('status').filter(status => status.textContent !== '');
    expect(statuses.map(status => status.textContent)).toEqual(['Loading more results']);
  });
});
