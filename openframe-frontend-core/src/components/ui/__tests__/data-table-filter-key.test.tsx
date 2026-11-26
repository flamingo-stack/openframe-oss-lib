import type { Column, ColumnDef, ColumnFiltersState, Table, Updater } from '@tanstack/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from '../data-table';
import { DataTableCell } from '../data-table/data-table-cell';
import { DataTableColumnFilter } from '../data-table/data-table-column-filter';
import { useDataTable } from '../data-table/use-data-table';
import { clearColumnFilter, columnFilterKey, withColumnFilterValue } from '../data-table/utils';

/**
 * A column can carry a filter stored under another key than its id (`meta.filter.id`) and titled for what it picks
 * (`meta.filter.title`): the devices DEVICE column carries the status filter once STATUS is gone. The host's column
 * filters then see only that key, from a value and from TanStack's functional updater alike.
 */

interface Row {
  id: string;
  name: string;
}

const OPTIONS = [
  { id: 'a', label: 'Kind A', value: 'a' },
  { id: 'b', label: 'Kind B', value: 'b' },
];

const COLUMNS: ColumnDef<Row>[] = [
  {
    id: 'name',
    header: 'NAME',
    cell: ({ row }) => row.original.name,
    meta: { filter: { options: OPTIONS, id: 'kind', title: 'Kind' } },
  },
];

function Host({
  layout,
  initial,
  onChange,
}: {
  layout: 'cards' | 'grid';
  initial: ColumnFiltersState;
  onChange: (updater: Updater<ColumnFiltersState>, next: ColumnFiltersState) => void;
}) {
  const [columnFilters, setColumnFilters] = useState(initial);
  const table = useDataTable<Row>({
    data: [{ id: 'r1', name: 'row-1' }],
    columns: COLUMNS,
    state: { columnFilters },
    onColumnFiltersChange: updater => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      onChange(updater, next);
      setColumnFilters(next);
    },
  });
  return (
    <DataTable table={table} layout={layout}>
      <DataTable.Header />
      <DataTable.Body />
    </DataTable>
  );
}

describe('meta.filter.id and meta.filter.title', () => {
  for (const layout of ['cards', 'grid'] as const) {
    it(`${layout}: the funnel keeps the header's label, takes the title, and writes only its key`, () => {
      const onChange = vi.fn();
      render(<Host layout={layout} initial={[{ id: 'other', value: ['x'] }]} onChange={onChange} />);
      expect(screen.getByText('NAME')).toBeTruthy();
      fireEvent.click(screen.getByLabelText('Filter by Kind'));
      expect(screen.getByRole('heading', { name: 'Kind' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Kind B/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      const [updater, next] = onChange.mock.lastCall as [Updater<ColumnFiltersState>, ColumnFiltersState];
      expect(typeof updater).toBe('function');
      expect(next).toEqual([
        { id: 'other', value: ['x'] },
        { id: 'kind', value: ['b'] },
      ]);
    });

    it(`${layout}: reads the host's value under the key and shows it applied`, () => {
      const onChange = vi.fn();
      render(<Host layout={layout} initial={[{ id: 'kind', value: ['a'] }]} onChange={onChange} />);
      fireEvent.click(screen.getByLabelText('Filter by Kind'));
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      expect((onChange.mock.lastCall as [unknown, ColumnFiltersState])[1]).toEqual([]);
    });
  }
});

describe('DataTableColumnFilter with a filter key', () => {
  /** A column `name` and a table holding `filters`, with the table's setter spied on. */
  function fixture(filters: ColumnFiltersState) {
    const setFilterValue = vi.fn();
    const column = { id: 'name', getFilterValue: () => undefined, setFilterValue } as unknown as Column<
      unknown,
      unknown
    >;
    const setColumnFilters = vi.fn();
    const table = { getState: () => ({ columnFilters: filters }), setColumnFilters } as unknown as Table<unknown>;
    return { column, table, setFilterValue, setColumnFilters };
  }

  it('reads and writes the key through the table, never the column', () => {
    const { column, table, setFilterValue, setColumnFilters } = fixture([{ id: 'kind', value: ['a'] }]);
    render(<DataTableColumnFilter column={column} table={table} filterId="kind" label="NAME" options={OPTIONS} />);
    // No title: the label names the funnel.
    fireEvent.click(screen.getByLabelText('Filter by NAME'));
    fireEvent.click(screen.getByRole('button', { name: /Kind B/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(setFilterValue).not.toHaveBeenCalled();
    const updater = setColumnFilters.mock.lastCall?.[0] as (old: ColumnFiltersState) => ColumnFiltersState;
    expect(updater([{ id: 'kind', value: ['a'] }])).toEqual([{ id: 'kind', value: ['a', 'b'] }]);
  });

  it("keeps the column's own API when the key is the column's id", () => {
    const { column, table, setFilterValue, setColumnFilters } = fixture([]);
    render(<DataTableColumnFilter column={column} table={table} label="NAME" title="Name" options={OPTIONS} />);
    fireEvent.click(screen.getByLabelText('Filter by Name'));
    fireEvent.click(screen.getByRole('button', { name: /Kind A/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(setColumnFilters).not.toHaveBeenCalled();
    expect(setFilterValue).toHaveBeenLastCalledWith(['a']);
  });
});

describe('column filter key helpers', () => {
  it('withColumnFilterValue replaces in place, appends, and removes', () => {
    const filters = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ];
    expect(withColumnFilterValue(filters, 'a', 3)).toEqual([
      { id: 'a', value: 3 },
      { id: 'b', value: 2 },
    ]);
    expect(withColumnFilterValue(filters, 'c', 4)).toEqual([...filters, { id: 'c', value: 4 }]);
    expect(withColumnFilterValue(filters, 'a', undefined)).toEqual([{ id: 'b', value: 2 }]);
  });

  it('columnFilterKey is meta.filter.id, else the column id', () => {
    const keyed = { id: 'device', columnDef: { meta: { filter: { options: [], id: 'status' } } } };
    const plain = { id: 'os', columnDef: {} };
    expect(columnFilterKey(keyed as unknown as Column<unknown, unknown>)).toBe('status');
    expect(columnFilterKey(plain as unknown as Column<unknown, unknown>)).toBe('os');
  });

  it('clearColumnFilter drops the filter under its key (a hidden column stops filtering)', () => {
    const setColumnFilters = vi.fn();
    const table = {
      getState: () => ({ columnFilters: [{ id: 'status', value: ['PENDING'] }] }),
      setColumnFilters,
    } as unknown as Table<unknown>;
    const column = {
      id: 'device',
      columnDef: { meta: { filter: { options: [], id: 'status' } } },
      getIsFiltered: () => false,
      setFilterValue: vi.fn(),
    } as unknown as Column<unknown, unknown>;
    clearColumnFilter(table, column);
    const updater = setColumnFilters.mock.lastCall?.[0] as (old: ColumnFiltersState) => ColumnFiltersState;
    expect(updater([{ id: 'status', value: ['PENDING'] }])).toEqual([]);
  });
});

describe('DataTable.Cell hugText', () => {
  /** The class of the main text's box (its tooltip trigger). */
  const textBoxClass = () => screen.getByText('hl-ws-210').parentElement?.className.split(' ') ?? [];

  /** The cell's markup. */
  const partMarkup = (container: HTMLElement): string => container.innerHTML;

  /** The classes of a part of the cell (`data-part`). */
  const partClass = (container: HTMLElement, part: string) =>
    new RegExp(`data-part="${part}" class="([^"]*)"`).exec(container.innerHTML)?.[1]?.split(' ') ?? [];

  it('lets the main text take only its width, so the tag sits right after it', () => {
    render(<DataTableCell text="hl-ws-210" tag={<span>PENDING</span>} hugText />);
    expect(textBoxClass()).not.toContain('flex-1');
    expect(textBoxClass()).toContain('min-w-0');
  });

  it('on a short line the text gives way first, down to its floor; then the tag, and the mark never', () => {
    const { container } = render(
      <DataTableCell text="hl-ws-210" tag={<span>PENDING DELETION</span>} mark={<span>!</span>} hugText />,
    );
    expect(textBoxClass()).toContain('flex-[0_9999_auto]');
    expect(partClass(container, 'tag')).toEqual(
      expect.arrayContaining(['min-w-0', 'max-w-[calc(100%_-_5rem_-_var(--spacing-system-xxs))]']),
    );
    expect(partClass(container, 'mark')).toContain('shrink-0');
    // The mark sits after the tag.
    const markup = partMarkup(container);
    expect(markup.indexOf('data-part="mark"')).toBeGreaterThan(markup.indexOf('data-part="tag"'));
  });

  it('by default the main text takes the line and the tag is never cut', () => {
    const { container } = render(<DataTableCell text="hl-ws-210" tag={<span>PENDING</span>} />);
    expect(textBoxClass()).toContain('flex-1');
    expect(partClass(container, 'tag')).toContain('shrink-0');
  });
});
