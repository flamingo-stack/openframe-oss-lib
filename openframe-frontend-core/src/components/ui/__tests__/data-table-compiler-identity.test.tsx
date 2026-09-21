import type { ColumnDef, Table } from '@tanstack/react-table';
import { render, renderHook, screen } from '@testing-library/react';
import { memo } from 'react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../data-table';
import { useDataTable } from '../data-table/use-data-table';

/**
 * What this pins down: `useDataTable` must hand back a NEW reference on every
 * render, because `useReactTable` creates one instance for the life of the
 * component and mutates it in place.
 *
 * Everything inside `<DataTable>` reads its rows back out of that instance
 * through context, so a caller compiled by the React Compiler caches
 * `<DataTable table={table}>` and its children on the table's identity — which
 * never changes — and a table that gains rows renders nothing new. On an
 * infinite-scroll table that is a request loop: the sentinel never moves down,
 * so `DataTable.InfiniteFooter` keeps asking for the next page.
 *
 * `CachedTable` below stands in for that compiled caller. `memo` bails out on
 * identical props exactly like the compiler's `if ($[n] !== table)` guard.
 */

interface Row {
  id: string;
  name: string;
}

const COLUMNS: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name', cell: ({ row }) => row.original.name }];

const getRowId = (row: Row) => row.id;

function rows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: `r${i}`, name: `row-${i}` }));
}

const CachedTable = memo(function CachedTableImpl({ table }: { table: Table<Row> }) {
  return (
    <DataTable table={table}>
      <DataTable.Body<Row> />
    </DataTable>
  );
});

function TableHost({ data }: { data: Row[] }) {
  const table = useDataTable<Row>({ data, columns: COLUMNS, getRowId });
  return <CachedTable table={table} />;
}

describe('useDataTable identity', () => {
  it('lets a consumer memoized on the table render rows that arrived later', () => {
    const { rerender } = render(<TableHost data={rows(2)} />);
    expect(screen.getAllByText(/^row-\d$/)).toHaveLength(2);

    rerender(<TableHost data={rows(4)} />);
    expect(screen.getAllByText(/^row-\d$/)).toHaveLength(4);
  });

  it('forwards reads and writes to the single underlying instance', () => {
    const { result, rerender } = renderHook(({ data }) => useDataTable<Row>({ data, columns: COLUMNS, getRowId }), {
      initialProps: { data: rows(3) },
    });

    const first = result.current;
    expect(first.getRowModel().rows).toHaveLength(3);
    // A write through one handle must be visible through the next one.
    first.setOptions(prev => ({ ...prev, meta: { probed: true } }));

    rerender({ data: rows(5) });
    expect(result.current).not.toBe(first);
    expect(result.current.getRowModel().rows).toHaveLength(5);
    expect(result.current.options.meta).toEqual({ probed: true });
  });
});
