import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionColumn,
  DataTable,
  gridPrefsStorageKey,
  selectionColumn,
  multiSelectFilterFn,
  type ColumnDef,
  type ColumnFiltersState,
  type DataTableSettings,
} from '../components/ui/data-table';
import {
  buildGridLayout,
  GRID_SETTINGS_ID,
  mergeColumnOrder,
  type GridLayoutOptions,
} from '../components/ui/data-table/data-table-grid';
import { createGridPrefsStore } from '../components/ui/data-table/data-table-grid-prefs';
import { dropIndex, moveId } from '../components/ui/data-table/data-table-grid-settings';
import { useDataTable } from '../components/ui/data-table/use-data-table';

/**
 * The grid table's settings: the gear in the header of the last column, its menu of columns (hide, show, reorder),
 * and the layout kept in the browser. jsdom has no layout, so a drag is covered by its two pure steps (`dropIndex`,
 * `moveId`) and the keyboard move; the drag itself is checked in the browser on the Settings story.
 */

interface Item {
  id: string;
  name: string;
  owner: string;
  city: string;
}

const ITEMS: Item[] = [
  { id: 'a', name: 'Alpha', owner: 'Ada', city: 'Kyiv' },
  { id: 'b', name: 'Beta', owner: 'Bob', city: 'Lviv' },
];

const DATA_COLUMNS: ColumnDef<Item>[] = [
  { id: 'name', accessorKey: 'name', header: 'NAME', size: 280, meta: { label: 'Name' } },
  { id: 'owner', accessorKey: 'owner', header: 'Owner', size: 200 },
  { id: 'city', accessorKey: 'city', header: 'City', size: 160 },
];
const COLUMNS: ColumnDef<Item>[] = [
  selectionColumn<Item>(),
  ...DATA_COLUMNS,
  actionColumn<Item>({ id: 'more', cell: () => <button type="button">More</button> }),
  actionColumn<Item>({ id: 'open', cell: () => <button type="button">Open</button> }),
];

const STORAGE_KEY = 'settings-test';
const stored = () => JSON.parse(localStorage.getItem(gridPrefsStorageKey(STORAGE_KEY)) ?? 'null') as unknown;
const store = (layout: { order?: string[]; hidden?: string[]; sizing?: Record<string, number> }) =>
  localStorage.setItem(
    gridPrefsStorageKey(STORAGE_KEY),
    JSON.stringify({ version: 1, order: [], hidden: [], sizing: {}, ...layout }),
  );

function Grid({ settings, columns = COLUMNS }: { settings?: DataTableSettings; columns?: ColumnDef<Item>[] }) {
  const table = useDataTable<Item>({ data: ITEMS, columns, getRowId: item => item.id });
  return (
    <DataTable table={table} layout="grid" settings={settings}>
      <DataTable.Header />
      <DataTable.Body<Item> />
    </DataTable>
  );
}

/** The grid header's data columns, in drawn order. */
function headerColumns(container: HTMLElement): string[] {
  return [...container.innerHTML.matchAll(/<[a-z]+[^>]*data-grid-header-cell[^>]*>/g)].map(
    match => /data-grid-col="(\w+)"/.exec(match[0])?.[1] ?? '',
  );
}

/** The markup of the grid form of the body (from its opening tag on). */
function gridBodyMarkup(container: HTMLElement): string {
  return container.innerHTML.slice(container.innerHTML.indexOf('data-grid-body'));
}

/** The markup before the grid form of the body: the card rows. */
function cardsMarkup(container: HTMLElement): string {
  return container.innerHTML.slice(0, container.innerHTML.indexOf('data-grid-body'));
}

/** The menu's rows, top to bottom: `Name ✓` for a shown column, `Name` for a hidden one. */
function menuRows(): string[] {
  return screen
    .getAllByRole('menuitemcheckbox')
    .map(row => `${row.textContent}${row.getAttribute('aria-checked') === 'true' ? ' ✓' : ''}`);
}

function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Table settings' }), { button: 0, pointerType: 'mouse' });
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('mergeColumnOrder', () => {
  it('keeps the designed order when nothing is saved', () => {
    expect(mergeColumnOrder(['a', 'b', 'c'], undefined)).toEqual(['a', 'b', 'c']);
    expect(mergeColumnOrder(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c']);
  });

  it('puts the saved columns in the saved order', () => {
    expect(mergeColumnOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('drops ids the table no longer has, and repeats', () => {
    expect(mergeColumnOrder(['a', 'b'], ['gone', 'b', 'b', 'a'])).toEqual(['b', 'a']);
  });

  it('puts a column the saved order does not name after the column it follows by design', () => {
    // `b` was added to the table after the layout was saved: it goes after `a`, not to the end.
    expect(mergeColumnOrder(['a', 'b', 'c'], ['c', 'a'])).toEqual(['c', 'a', 'b']);
    // A new first column has nothing before it: it goes first.
    expect(mergeColumnOrder(['new', 'a', 'b'], ['b', 'a'])).toEqual(['new', 'b', 'a']);
  });
});

describe('buildGridLayout with the viewer’s layout', () => {
  function layoutOf(options: GridLayoutOptions, columns = COLUMNS) {
    return renderHook(() => {
      const table = useDataTable<Item>({ data: ITEMS, columns });
      return buildGridLayout(table.getVisibleFlatColumns(), options);
    }).result.current;
  }
  const ids = (options: GridLayoutOptions, columns = COLUMNS) => layoutOf(options, columns).columns.map(c => c.id);

  it('orders and hides the data columns only: selection stays first, actions last', () => {
    expect(ids({ order: ['city', 'name', 'owner'], hidden: ['owner', 'select', 'more'] })).toEqual([
      'select',
      'city',
      'name',
      'more',
      'open',
    ]);
  });

  it('pins whichever data column is first now', () => {
    const layout = layoutOf({ order: ['city', 'name', 'owner'] });
    const byId = Object.fromEntries(layout.columns.map(column => [column.id, column]));
    expect(byId.city).toMatchObject({ pin: 'left', offset: 48 });
    expect(byId.name?.pin).toBeUndefined();
    expect(layout.pinnedLeft).toBe(48 + 160);
  });

  it('does not apply a layout that hides every column the table has', () => {
    expect(ids({ hidden: ['name', 'owner', 'city'] })).toEqual(['select', 'name', 'owner', 'city', 'more', 'open']);
  });

  it('takes a resized width for a data column and never for a utility column', () => {
    const layout = layoutOf({ sizing: { owner: 320, more: 300, select: 300 } });
    const byId = Object.fromEntries(layout.columns.map(column => [column.id, column]));
    expect(byId.owner?.size).toBe(320);
    expect(byId.more?.size).toBe(56);
    expect(byId.select?.size).toBe(48);
  });

  it('marks the last action column as the one whose header is the gear', () => {
    const marked = (options: GridLayoutOptions) =>
      layoutOf(options)
        .columns.filter(column => column.settings)
        .map(column => column.id);
    expect(marked({ settings: true })).toEqual(['open']);
    expect(marked({})).toEqual([]);
  });

  it('adds a column for the gear to a table with settings and no action column', () => {
    const layout = layoutOf({ settings: true }, DATA_COLUMNS);
    const last = layout.columns[layout.columns.length - 1];
    expect(last).toMatchObject({ id: GRID_SETTINGS_ID, kind: 'action', pin: 'right', size: 56, settings: true });
    expect(layoutOf({}, DATA_COLUMNS).columns.map(column => column.id)).not.toContain(GRID_SETTINGS_ID);
  });
});

describe('the settings menu’s drag steps', () => {
  it('lands a dragged row after every row whose middle is above the pointer', () => {
    // The other rows' middles, top to bottom.
    const middles = [20, 60, 100];
    expect(dropIndex(middles, 5)).toBe(0);
    expect(dropIndex(middles, 61)).toBe(2);
    expect(dropIndex(middles, 500)).toBe(3);
  });

  it('moves one id and keeps the others in order', () => {
    expect(moveId(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveId(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('createGridPrefsStore', () => {
  it('reads the layout kept under the table’s key and writes every change back', () => {
    store({ hidden: ['owner'] });
    const prefs = createGridPrefsStore(STORAGE_KEY);
    expect(prefs.get().hidden).toEqual(['owner']);
    prefs.update(current => ({ ...current, order: ['city', 'name'] }));
    expect(stored()).toEqual({ version: 1, order: ['city', 'name'], hidden: ['owner'], sizing: {} });
  });

  it('keeps a drag’s steps out of storage until it is told to write', () => {
    const prefs = createGridPrefsStore(STORAGE_KEY);
    prefs.update(current => ({ ...current, sizing: { owner: 240 } }), { persist: false });
    expect(prefs.get().sizing).toEqual({ owner: 240 });
    expect(stored()).toBeNull();
    prefs.persist();
    expect(stored()).toMatchObject({ sizing: { owner: 240 } });
  });

  it('ignores a stored value of another shape', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(gridPrefsStorageKey(STORAGE_KEY), JSON.stringify({ version: 1, order: 'name', hidden: [] }));
    expect(createGridPrefsStore(STORAGE_KEY).get()).toEqual({ order: [], hidden: [], sizing: {} });
    localStorage.setItem(gridPrefsStorageKey(STORAGE_KEY), '{not json');
    expect(createGridPrefsStore(STORAGE_KEY).get()).toEqual({ order: [], hidden: [], sizing: {} });
    warn.mockRestore();
  });

  it('holds the layout in memory when the table has no key', () => {
    const prefs = createGridPrefsStore();
    prefs.update(current => ({ ...current, hidden: ['owner'] }));
    expect(prefs.get().hidden).toEqual(['owner']);
    expect(localStorage.length).toBe(0);
  });

  it('tells its subscribers about a change, and not about a change to the same value', () => {
    const prefs = createGridPrefsStore();
    const listener = vi.fn();
    prefs.subscribe(listener);
    prefs.update(current => current);
    expect(listener).not.toHaveBeenCalled();
    prefs.update(current => ({ ...current, hidden: ['owner'] }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('<DataTable layout="grid" settings>', () => {
  it('has no gear without settings', () => {
    render(<Grid />);
    expect(screen.queryByRole('button', { name: 'Table settings' })).not.toBeInTheDocument();
  });

  it('lists the data columns by name, shown ones checked, and never the selection or action columns', () => {
    render(<Grid settings={{}} />);
    openMenu();
    // `meta.label` first ("Name", where the header reads "NAME"), then the header text.
    expect(menuRows()).toEqual(['Name ✓', 'Owner ✓', 'City ✓']);
  });

  it('hides a column from the table and lists it under the shown ones; a second click shows it again', () => {
    const { container } = render(<Grid settings={{ storageKey: STORAGE_KEY }} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Owner' }));
    expect(headerColumns(container)).toEqual(['name', 'city']);
    expect(menuRows()).toEqual(['Name ✓', 'City ✓', 'Owner']);
    // The menu stays open: it is a list of switches.
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(stored()).toMatchObject({ hidden: ['owner'] });

    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Owner' }));
    // Back in its own place, not at the end.
    expect(headerColumns(container)).toEqual(['name', 'owner', 'city']);
    expect(stored()).toMatchObject({ hidden: [] });
  });

  it('keeps the last shown column: a table needs one', () => {
    const { container } = render(<Grid settings={{}} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Owner' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'City' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Name' }));
    expect(headerColumns(container)).toEqual(['name']);
    expect(menuRows()).toEqual(['Name ✓', 'Owner', 'City']);
  });

  it('moves a shown column with Alt + Arrow, in the table and in storage; a hidden column keeps its place', () => {
    const { container } = render(<Grid settings={{ storageKey: STORAGE_KEY }} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Owner' }));
    fireEvent.keyDown(screen.getByRole('menuitemcheckbox', { name: 'Name' }), { key: 'ArrowDown', altKey: true });
    expect(headerColumns(container)).toEqual(['city', 'name']);
    expect(menuRows()).toEqual(['City ✓', 'Name ✓', 'Owner']);
    // `owner` stays between the two it sat between.
    expect(stored()).toMatchObject({ order: ['city', 'owner', 'name'], hidden: ['owner'] });
    // The moved row keeps the focus, so the next press moves it again.
    expect(screen.getByRole('menuitemcheckbox', { name: 'Name' })).toHaveFocus();

    // Past the end: nothing moves.
    fireEvent.keyDown(screen.getByRole('menuitemcheckbox', { name: 'Name' }), { key: 'ArrowDown', altKey: true });
    expect(headerColumns(container)).toEqual(['city', 'name']);
  });

  it('draws the layout kept in the browser: order, hidden columns, widths', () => {
    store({ order: ['city', 'owner', 'name'], hidden: ['owner'], sizing: { city: 300 } });
    const { container } = render(<Grid settings={{ storageKey: STORAGE_KEY }} />);
    expect(headerColumns(container)).toEqual(['city', 'name']);
    // select 48, then city at its saved width.
    expect(container.innerHTML).toContain('--dtc1-w: 300px');
    // The rows follow the header.
    const body = gridBodyMarkup(container);
    expect(body.indexOf('Kyiv')).toBeLessThan(body.indexOf('Alpha'));
    expect(body).not.toContain('Ada');
  });

  it('keeps a resized width in the browser', () => {
    const { container } = render(<Grid settings={{ storageKey: STORAGE_KEY }} />);
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Owner column' }), { key: 'ArrowRight' });
    expect(container.innerHTML).toContain('--dtc2-w: 216px');
    expect(stored()).toMatchObject({ sizing: { owner: 216 } });
  });

  it('keeps nothing in the browser for a table without a key', () => {
    render(<Grid settings={{}} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Owner' }));
    expect(localStorage.length).toBe(0);
  });

  it('leaves the card rows as designed: the layout is the grid’s', () => {
    store({ hidden: ['owner'] });
    const { container } = render(<Grid settings={{ storageKey: STORAGE_KEY }} />);
    expect(cardsMarkup(container)).toContain('Ada');
  });

  it('offers auto-refresh only when the page does, and hands the switch to the page', () => {
    function WithAutoRefresh() {
      const [enabled, setEnabled] = useState(false);
      return <Grid settings={{ autoRefresh: { enabled, onChange: setEnabled } }} />;
    }
    render(<WithAutoRefresh />);
    openMenu();
    const row = screen.getByRole('menuitemcheckbox', { name: 'Enable auto-refresh' });
    expect(row).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(row);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Enable auto-refresh' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('resets the filter of a column it hides, and no other filter', () => {
    const FILTER_COLUMNS: ColumnDef<Item>[] = [
      { id: 'name', accessorKey: 'name', header: 'Name', size: 280 },
      {
        id: 'owner',
        accessorKey: 'owner',
        header: 'Owner',
        size: 200,
        // Typed for an erased row; the lib's own tables hand it to a typed column the same way.
        filterFn: multiSelectFilterFn as unknown as ColumnDef<Item>['filterFn'],
        meta: { filter: { options: [{ id: 'Ada', label: 'Ada', value: 'Ada' }] } },
      },
      { id: 'city', accessorKey: 'city', header: 'City', size: 160 },
    ];
    function FilteredGrid() {
      const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([{ id: 'owner', value: ['Ada'] }]);
      const table = useDataTable<Item>({
        data: ITEMS,
        columns: FILTER_COLUMNS,
        getRowId: item => item.id,
        clientSideFiltering: true,
        state: { columnFilters },
        onColumnFiltersChange: setColumnFilters,
      });
      return (
        <DataTable table={table} layout="grid" settings={{}}>
          <DataTable.Header />
          <DataTable.Body<Item> />
        </DataTable>
      );
    }
    const { container } = render(<FilteredGrid />);
    // Filtered to Ada's row: Beta (Bob's) is not in the table.
    expect(gridBodyMarkup(container)).not.toContain('Beta');
    openMenu();
    // Another column goes: the Owner filter stays.
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'City' }));
    expect(gridBodyMarkup(container)).not.toContain('Beta');
    // The filtered column goes: nothing on screen would show its filter, so the filter goes with it.
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Owner' }));
    expect(gridBodyMarkup(container)).toContain('Beta');
  });

  it('does not render the header again for a resize: only the root restates the widths', () => {
    const renders = { name: 0 };
    const COUNTED: ColumnDef<Item>[] = [
      {
        id: 'name',
        accessorKey: 'name',
        size: 280,
        header: () => {
          renders.name += 1;
          return 'Name';
        },
      },
      { id: 'owner', accessorKey: 'owner', header: 'Owner', size: 200 },
    ];
    const { container } = render(<Grid settings={{}} columns={COUNTED} />);
    const before = renders.name;
    fireEvent.keyDown(screen.getByRole('separator', { name: 'Resize Owner column' }), { key: 'ArrowRight' });
    expect(container.innerHTML).toContain('--dtc1-w: 216px');
    expect(renders.name).toBe(before);
  });

  it('gives the gear a column of its own when the table has no action column', () => {
    render(<Grid settings={{}} columns={DATA_COLUMNS} />);
    expect(screen.getByRole('button', { name: 'Table settings' })).toBeInTheDocument();
  });
});
