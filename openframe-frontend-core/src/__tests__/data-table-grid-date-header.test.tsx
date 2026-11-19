import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type ColumnDef, type DataTableDateFilter } from '../components/ui/data-table';
import { isDateFilterApplied } from '../components/ui/data-table/data-table-date-filter';
import { useDataTable } from '../components/ui/data-table/use-data-table';

/**
 * The grid header of a date column (`meta.dateFilter`): the label and a calendar opening the date menu, its applied
 * state, and what it replaces in the cell (the filter funnel, the sort arrows). The menu itself is `DateFilterMenu`'s.
 */

interface Entry {
  id: string;
  when: string;
  status: string;
}

const ENTRIES: Entry[] = [
  { id: 'a', when: '2026-11-01', status: 'ok' },
  { id: 'b', when: '2026-11-02', status: 'failed' },
];

const STATUS_OPTIONS = [{ id: 'ok', label: 'OK', value: 'ok' }];

function Table({
  filter,
  layout = 'grid',
  loading = false,
  withFilterAndSort = false,
}: {
  filter: DataTableDateFilter;
  layout?: 'grid' | 'cards';
  loading?: boolean;
  /** The column also declares a filter and a sort: the date menu is the one control the header draws. */
  withFilterAndSort?: boolean;
}) {
  const columns: ColumnDef<Entry>[] = [
    {
      id: 'when',
      accessorKey: 'when',
      header: 'Started',
      size: 240,
      meta: {
        dateFilter: filter,
        ...(withFilterAndSort ? { filter: { options: STATUS_OPTIONS }, sortable: true } : {}),
      },
    },
    { id: 'status', accessorKey: 'status', header: 'Status', size: 160, meta: { filter: { options: STATUS_OPTIONS } } },
  ];
  const table = useDataTable<Entry>({ data: loading ? [] : ENTRIES, columns, getRowId: entry => entry.id });
  return (
    <DataTable table={table} layout={layout}>
      <DataTable.Header loading={loading} />
      <DataTable.Body<Entry> loading={loading} skeletonRows={2} />
    </DataTable>
  );
}

const idle = (onApply = vi.fn()): DataTableDateFilter => ({ sortDirection: 'desc', range: undefined, onApply });

const dateTrigger = () => screen.getByRole('button', { name: /^Started/ });

/** The classes of the trigger's label and of its calendar glyph. */
function triggerTones() {
  return {
    label: screen.getByText('Started').className,
    icon: /<svg[^>]*class="([^"]*)"/.exec(dateTrigger().innerHTML)?.[1] ?? '',
  };
}

/** How many header cells are a loading bar. */
function loadingHeaderCells(container: HTMLElement): number {
  return container.innerHTML.split('data-grid-header-loading').length - 1;
}

/** A header cell's opening tag and what it holds, as markup, by column id. */
function headerCell(container: HTMLElement, id: string): { tag: string; content: string } {
  const markup = container.innerHTML;
  const tag = new RegExp(`<div[^>]*data-grid-col="${id}"[^>]*>`).exec(markup);
  if (!tag) return { tag: '', content: '' };
  const from = tag.index + tag[0].length;
  const next = markup.indexOf('data-grid-header-cell', from);
  const end = next === -1 ? markup.indexOf('data-grid-body', from) : next;
  return { tag: tag[0], content: markup.slice(from, end) };
}

describe('isDateFilterApplied', () => {
  it('is off on the list’s own order with no range', () => {
    expect(isDateFilterApplied(idle())).toBe(false);
    expect(isDateFilterApplied({ ...idle(), sortDirection: 'asc', defaultSortDirection: 'asc' })).toBe(false);
  });

  it('is on with a range, or with a direction that is not the list’s own', () => {
    expect(isDateFilterApplied({ ...idle(), range: { from: new Date(2026, 10, 1), to: undefined } })).toBe(true);
    expect(isDateFilterApplied({ ...idle(), sortDirection: 'asc' })).toBe(true);
    expect(isDateFilterApplied({ ...idle(), defaultSortDirection: 'asc' })).toBe(true);
  });
});

describe('DataTable grid header: a date column', () => {
  it('draws the label and a calendar as one trigger, named by the column first', () => {
    render(<Table filter={idle()} />);
    const trigger = dateTrigger();
    expect(trigger).toHaveAttribute('data-grid-date-filter');
    expect(trigger).toHaveAccessibleName('Started, sort and filter by date');
    expect(trigger.innerHTML).toContain('<svg');
    // One line, as wide as the cell and as high as the header row.
    expect(screen.getByText('Started').className).toContain('whitespace-nowrap');
    expect(trigger.className).toContain('h-12');
    expect(trigger.className).toContain('w-full');
  });

  it('stays grey until applied', () => {
    render(<Table filter={idle()} />);
    const { label, icon } = triggerTones();
    expect(label).toContain('text-ods-text-secondary');
    expect(icon).toContain('text-ods-text-secondary');
    expect(dateTrigger()).not.toHaveAttribute('data-applied');
  });

  it('shows an applied range: primary label, accent calendar', () => {
    render(<Table filter={{ ...idle(), range: { from: new Date(2026, 10, 1), to: new Date(2026, 10, 7) } }} />);
    const { label, icon } = triggerTones();
    expect(label).toContain('text-ods-text-primary');
    expect(icon).toContain('text-ods-accent');
    expect(dateTrigger()).toHaveAttribute('data-applied');
  });

  it('shows a direction that is not the list’s own as applied', () => {
    render(<Table filter={{ ...idle(), sortDirection: 'asc' }} />);
    expect(triggerTones().icon).toContain('text-ods-accent');
  });

  it('opens the date menu on the applied values and commits them on Apply', () => {
    const onApply = vi.fn();
    const range = { from: new Date(2026, 10, 1), to: new Date(2026, 10, 7) };
    render(<Table filter={{ ...idle(onApply), sortDirection: 'asc', range }} />);
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    fireEvent.click(dateTrigger());
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ sort: 'asc', range });
  });

  it('resets to the list’s own direction, which the column may state', () => {
    const onApply = vi.fn();
    const { unmount } = render(<Table filter={{ ...idle(onApply), sortDirection: 'asc' }} />);
    fireEvent.click(dateTrigger());
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onApply).toHaveBeenLastCalledWith({ sort: 'desc', range: undefined });
    unmount();

    render(<Table filter={{ ...idle(onApply), defaultSortDirection: 'asc' }} />);
    fireEvent.click(dateTrigger());
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onApply).toHaveBeenLastCalledWith({ sort: 'asc', range: undefined });
  });

  it('is the one control of its header: no funnel and no sort arrows beside it', () => {
    const { container } = render(<Table filter={idle()} withFilterAndSort />);
    const cell = headerCell(container, 'when');
    expect(cell.content).toContain('data-grid-date-filter');
    expect(cell.content).not.toContain('Filter by Started');
    // The calendar is the cell's only 16px glyph (a funnel and a sort arrow are that size too; the resize handle's
    // grip is smaller), and the cell itself is not a sort button.
    expect(cell.content.match(/<svg[^>]*h-4 w-4/g)).toHaveLength(1);
    expect(cell.tag).not.toContain('cursor-pointer');
    // The plain filter column beside it keeps its funnel.
    expect(headerCell(container, 'status').content).toContain('Filter by Status');
  });

  it('names no column while loading: a bar, no calendar', () => {
    const { container } = render(<Table filter={idle()} loading />);
    expect(screen.queryByText('Started')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('data-grid-date-filter');
    expect(loadingHeaderCells(container)).toBe(2);
  });

  it('is not read by a cards table: its header keeps the plain label', () => {
    const { container } = render(<Table filter={idle()} layout="cards" />);
    expect(container.innerHTML).not.toContain('data-grid-date-filter');
    expect(screen.getAllByText('Started').length).toBeGreaterThan(0);
  });
});
