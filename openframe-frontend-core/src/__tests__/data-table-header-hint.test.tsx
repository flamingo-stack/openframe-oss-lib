import { createColumnHelper } from '@tanstack/react-table';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../components/ui/data-table';
import { DATA_TABLE_HEADER_LABEL_CLASS } from '../components/ui/data-table/data-table-header';
import { useDataTable } from '../components/ui/data-table/use-data-table';

/**
 * `meta.hint` draws a header's definition in an InfoHint named after the
 * column, and a header label wraps inside its cell rather than painting across
 * the next column. Both used to be hand-rolled per table with a node header.
 */

interface Row {
  id: string;
  name: string;
}

const columnHelper = createColumnHelper<Row>();

function HintTable({ hint, filterable = false }: { hint?: string; filterable?: boolean }) {
  const columns = [
    columnHelper.accessor('name', {
      id: 'name',
      header: 'Implementation owners',
      meta: {
        hint,
        ...(filterable ? { filter: { options: [{ id: 'a', label: 'A', value: 'a' }] } } : {}),
      },
    }),
  ];
  const table = useDataTable({ data: [{ id: '1', name: 'Alpha' }], columns });
  return (
    <DataTable table={table}>
      <DataTable.Header />
    </DataTable>
  );
}

describe('DataTable header hint', () => {
  it('draws the definition beside a plain header, named after the column', () => {
    render(<HintTable hint="Engineers building it." />);
    expect(screen.getByRole('button', { name: 'About Implementation owners' })).toBeTruthy();
  });

  it('draws it beside a FILTER header too', () => {
    render(<HintTable hint="Engineers building it." filterable />);
    expect(screen.getByRole('button', { name: 'About Implementation owners' })).toBeTruthy();
  });

  it('draws nothing extra without a hint', () => {
    render(<HintTable />);
    expect(screen.queryByRole('button', { name: /^About / })).toBeNull();
  });

  it('the shared label class wraps inside the cell', () => {
    expect(DATA_TABLE_HEADER_LABEL_CLASS).not.toContain('whitespace-nowrap');
    expect(DATA_TABLE_HEADER_LABEL_CLASS).toContain('min-w-0');
    // A GOOD break: even lines, never one word stranded on its own.
    expect(DATA_TABLE_HEADER_LABEL_CLASS).toContain('text-balance');
  });

  it('pins the hint to the first line of a label that breaks onto two', () => {
    // The assertion is about a CLASS reaching the DOM, which has no
    // accessible-name equivalent to query by.
    const { container } = render(<HintTable hint="Engineers building it." />);
    expect(container.innerHTML).toContain('flex min-w-0 items-start gap-[var(--spacing-system-xxs)]');
  });
});
