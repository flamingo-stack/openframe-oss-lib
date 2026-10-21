import { createColumnHelper } from '@tanstack/react-table';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEVICES_GRID_SKELETON_CARDS, DevicesGrid } from '../components/features/devices/devices-grid';
import { DataTable } from '../components/ui/data-table';
import { useDataTable } from '../components/ui/data-table/use-data-table';
import { Table as LegacyTable } from '../components/ui/table/table';

/**
 * A table is a read list: every loaded row and every skeleton row is a `data-loading-item`, so the height gate counts
 * the rows a page shows (the skeleton's page against the loaded page) and measures what is below the list apart from it.
 * Pad rows (`minRows`) reserve height and are not items.
 */

interface Row {
  id: string;
  name: string;
}

const columnHelper = createColumnHelper<Row>();
const columns = [columnHelper.accessor('name', { id: 'name', header: 'Name' })];
const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Row ${i}` }));

function Table({ data, loading = false, minRows }: { data: Row[]; loading?: boolean; minRows?: number }) {
  const table = useDataTable({ data, columns, initialState: { pagination: { pageSize: 5 } } });
  return (
    <DataTable table={table}>
      <DataTable.Body<Row> loading={loading} minRows={minRows} />
    </DataTable>
  );
}

const ITEM = '[data-loading-item]';

describe('DataTable rows are loading items', () => {
  it('a loading table draws one full page of skeleton rows, each an item', () => {
    const { container } = render(<Table data={[]} loading />);
    expect(container.querySelectorAll(ITEM).length).toBe(5);
  });

  it('every loaded row is an item, and pad rows are not', () => {
    const { container } = render(<Table data={rows(3)} minRows={5} />);
    expect(container.querySelectorAll(ITEM).length).toBe(3);
  });

  it('the legacy Table marks its loaded rows the same way', () => {
    const { container } = render(
      <LegacyTable<Row> data={rows(2)} columns={[{ key: 'name', label: 'Name' }]} rowKey="id" />,
    );
    expect(container.querySelectorAll(ITEM).length).toBe(2);
  });
});

describe('the devices grid draws its host page', () => {
  it('a loading grid draws one card per row of the page size, each an item', () => {
    const { container } = render(<DevicesGrid devices={[]} isLoading pageSize={7} />);
    expect(container.querySelectorAll(ITEM).length).toBe(7);
  });

  it('with no page size it draws its declared default', () => {
    const { container } = render(<DevicesGrid devices={[]} isLoading />);
    expect(container.querySelectorAll(ITEM).length).toBe(DEVICES_GRID_SKELETON_CARDS);
  });
});

describe('the devices grid is one grid, loaded and loading', () => {
  it('the loading grid and the loaded grid share the grid class, and loading cards hide the "more" button', () => {
    const loading = render(<DevicesGrid devices={[]} isLoading pageSize={2} />).container;
    const loaded = render(
      <DevicesGrid devices={[{ id: 'a', machineId: 'a', hostname: 'Host' } as never]} isLoading={false} />,
    ).container;
    const gridOf = (c: HTMLElement) => c.querySelector('[data-loading-item]')?.parentElement?.className;
    expect(gridOf(loading)).toBe(gridOf(loaded));
    expect(gridOf(loading)).toContain('content-lg:grid-cols-3');
    // The "more" button's bordered p-3 box: the grid's cards carry none, loading or loaded.
    expect(loading.querySelector('.p-3')).toBeNull();
  });
});

describe('a skeleton count is declared, never typed', () => {
  it('the paged table body falls back to the table page size when the host passes none', () => {
    const { container } = render(<Table data={[]} loading />);
    expect(container.querySelectorAll(ITEM).length).toBe(5);
  });
});
