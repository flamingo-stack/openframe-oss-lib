import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { type UIEvent, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComposerDockHeightContext } from '../components/navigation/app-layout-context';
import {
  actionColumn,
  DataTable,
  selectionColumn,
  type ColumnDef,
  type DataTableSortState,
  type RowSelectionState,
} from '../components/ui/data-table';
import {
  buildGridLayout,
  createGridScrollController,
  GRID_FILLER_ID,
  gridCellClass,
  type GridColumn,
  type GridLayoutOptions,
  type GridPinFirstColumn,
} from '../components/ui/data-table/data-table-grid';
import { useDataTable } from '../components/ui/data-table/use-data-table';
import { LoadingScope } from '../components/ui/loading-scope';

/**
 * The grid layout (`<DataTable layout="grid">`). jsdom has no layout, so what is locked here is the structure and the
 * state: the column order and pinning rule, the grid being the one form of the body at every width, the classes that make a row 48px and one line, selection on memoised rows, and
 * a checkbox inside a row link. Sizes, sticky positions and gradients are measured in the browser on the stories.
 */

interface Item {
  id: string;
  name: string;
  owner: string;
}

const ITEMS: Item[] = [
  { id: 'a', name: 'Alpha', owner: 'Ada' },
  { id: 'b', name: 'Beta', owner: 'Bob' },
  { id: 'c', name: 'Gamma', owner: 'Cy' },
];

const COLUMNS: ColumnDef<Item>[] = [
  // Given LAST on purpose: the grid still draws it first.
  actionColumn<Item>({ id: 'more', cell: () => <button type="button">More</button> }),
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    size: 280,
    meta: { sortable: true, gridCell: ({ row }) => <DataTable.Cell text={`grid:${row.original.name}`} /> },
  },
  {
    id: 'owner',
    accessorKey: 'owner',
    header: 'Owner',
    size: 200,
    meta: { gridCell: ({ row }) => `grid:${row.original.owner}` },
  },
  selectionColumn<Item>(),
];

function Grid({
  items = ITEMS,
  layout = 'grid',
  loading = false,
  maxHeight,
  pinFirstColumn,
}: {
  items?: Item[];
  layout?: 'grid' | 'cards';
  loading?: boolean;
  maxHeight?: number | 'fill';
  pinFirstColumn?: GridPinFirstColumn;
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sort, setSort] = useState<DataTableSortState | null>(null);
  const table = useDataTable<Item>({
    data: loading ? [] : items,
    columns: COLUMNS,
    getRowId: item => item.id,
    enableRowSelection: true,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });
  return (
    <DataTable table={table} layout={layout} maxHeight={maxHeight} pinFirstColumn={pinFirstColumn}>
      <DataTable.Meta>
        <DataTable.RowCount />
      </DataTable.Meta>
      <DataTable.Header
        sort={sort}
        onSortChange={id => setSort({ id, desc: sort?.id === id ? !sort.desc : false })}
        loading={loading}
      />
      <DataTable.Body<Item> loading={loading} skeletonRows={2} rowHref={item => `/items/${item.id}`} />
    </DataTable>
  );
}

/** The opening tag of the element carrying `marker` (an attribute or a class), read off the markup. */
function openingTag(container: HTMLElement, marker: string): string {
  return new RegExp(`<[a-z]+[^>]*${marker}[^>]*>`).exec(container.innerHTML)?.[0] ?? '';
}

/** The markup of the grid form of the body (from its opening tag on). */
function gridHeaderMarkup(container: HTMLElement): string {
  const html = container.innerHTML;
  return html.slice(html.indexOf('data-grid-header="'), html.indexOf('data-grid-body'));
}

/** The markup of the grid form of the body (from its opening tag on). */
function gridBodyMarkup(container: HTMLElement): string {
  return container.innerHTML.slice(container.innerHTML.indexOf('data-grid-body'));
}

/** How many row slots the table draws: a loaded row and a loading row carry the same marker. */
function rowSlots(container: HTMLElement): number {
  return container.innerHTML.split('data-loading-item').length - 1;
}

/** A grid table with rows and an infinite footer that is reading the next page. */
function GridLoadingMore() {
  const table = useDataTable<Item>({ data: ITEMS, columns: COLUMNS, getRowId: item => item.id });
  return (
    <DataTable table={table} layout="grid">
      <DataTable.Header />
      <DataTable.Body<Item> />
      <DataTable.InfiniteFooter hasNextPage isFetchingNextPage onLoadMore={() => undefined} skeletonRows={2} />
    </DataTable>
  );
}

/** Which edges have a gradient, in document order. */
function gradientEdges(container: HTMLElement): string[] {
  return [...container.innerHTML.matchAll(/data-grid-gradient="(\w+)"/g)].map(match => match[1] ?? '');
}

/** Each gradient's inline style, in document order. */
function gradientStyles(container: HTMLElement): string[] {
  return [...container.innerHTML.matchAll(/data-grid-gradient="\w+"[^>]*style="([^"]*)"/g)].map(
    match => match[1] ?? '',
  );
}

/** A row's checkbox, by the row's place in the table. */
function gridRowCheckbox(index: number): HTMLElement {
  const all = screen.getAllByRole('checkbox', { name: 'Select row' });
  const checkbox = all[index];
  if (!checkbox) throw new Error(`no grid checkbox ${index}`);
  return checkbox;
}

describe('buildGridLayout', () => {
  function layoutOf(columns: ColumnDef<Item>[], options?: GridLayoutOptions) {
    return renderHook(() => {
      const table = useDataTable<Item>({ data: ITEMS, columns });
      return buildGridLayout(table.getVisibleFlatColumns(), options);
    }).result.current;
  }

  it('orders selection first and actions last, and gives the free width to the last data column', () => {
    const layout = layoutOf(COLUMNS);
    expect(layout.columns.map(column => column.id)).toEqual(['select', 'name', 'owner', 'more']);
    // No empty column before the actions: the last data column grows instead.
    expect(layout.columns.filter(column => column.grow).map(column => column.id)).toEqual(['owner']);
    const owner = layout.columns.find(column => column.id === 'owner') as GridColumn;
    expect(gridCellClass(owner, 'body').split(' ')).toEqual(expect.arrayContaining(['flex-auto', 'shrink-0']));
  });

  it('keeps a filler only for a table with no data column to grow', () => {
    const layout = layoutOf(COLUMNS.filter(column => column.id !== 'name' && column.id !== 'owner'));
    expect(layout.columns.map(column => column.id)).toEqual(['select', GRID_FILLER_ID, 'more']);
  });

  it('pins the selection and the first data column left and the actions right, with their offsets', () => {
    const layout = layoutOf([...COLUMNS, actionColumn<Item>({ id: 'open', cell: () => null })]);
    const byId = Object.fromEntries(layout.columns.map(column => [column.id, column]));
    expect(byId.select).toMatchObject({ pin: 'left', offset: 0, size: 48 });
    expect(byId.name).toMatchObject({ pin: 'left', offset: 48, size: 280 });
    expect(byId.owner?.pin).toBeUndefined();
    // Right offsets count from the right edge: the last action sits at 0.
    // Each action is a column of its own: the first opens the block with its divider, and every action but the last
    // carries the divider to the next one.
    expect(byId.open).toMatchObject({
      pin: 'right',
      offset: 0,
      size: 56,
      startsRightBlock: false,
      dividedRight: false,
    });
    expect(byId.more).toMatchObject({ pin: 'right', offset: 56, size: 56, startsRightBlock: true, dividedRight: true });
    expect(layout.pinnedLeft).toBe(328);
    expect(layout.pinnedRight).toBe(112);
  });

  it('draws a divider on each side of an action column that has another action after it', () => {
    const layout = layoutOf([...COLUMNS, actionColumn<Item>({ id: 'open', cell: () => null })]);
    const byId = Object.fromEntries(layout.columns.map(column => [column.id, column]));
    const classesOf = (id: string) => gridCellClass(byId[id], 'body').split(' ');
    expect(classesOf('more')).toEqual(expect.arrayContaining(['border-l', 'border-r']));
    expect(classesOf('open')).not.toContain('border-l');
    expect(classesOf('open')).not.toContain('border-r');
  });

  it('pins only the first data column when there is no selection column', () => {
    const layout = layoutOf(COLUMNS.filter(column => column.id !== 'select'));
    expect(layout.columns[0]).toMatchObject({ id: 'name', pin: 'left', offset: 0 });
    expect(layout.pinnedLeft).toBe(280);
  });

  describe('pinFirstColumn', () => {
    const pinsOf = (options?: GridLayoutOptions) =>
      layoutOf(COLUMNS, options).columns.map(column => [column.id, column.pinAt]);

    it('marks the left block with the shared rule by default, and the right block with none', () => {
      expect(pinsOf()).toEqual([
        ['select', 'wide'],
        ['name', 'wide'],
        ['owner', undefined],
        ['more', undefined],
      ]);
    });

    it('marks the left block `desktop` when asked: the checkbox column and the first data column', () => {
      expect(pinsOf({ pinFirstColumn: 'desktop' })).toEqual([
        ['select', 'desktop'],
        ['name', 'desktop'],
        ['owner', undefined],
        ['more', undefined],
      ]);
    });

    it('pins a `desktop` cell on the window alone, and a `wide` one on the window and the content area', () => {
      const name = (pinFirstColumn: GridPinFirstColumn) =>
        gridCellClass(
          layoutOf(COLUMNS, { pinFirstColumn }).columns.find(column => column.id === 'name') as GridColumn,
          'body',
        ).split(' ');
      expect(name('desktop')).toEqual(expect.arrayContaining(['lg:sticky', 'lg:z-[1]']));
      expect(name('desktop').join(' ')).not.toMatch(/content-md:|(^| )sticky( |$)/);
      expect(name('wide')).toEqual(expect.arrayContaining(['lg:content-md:sticky', 'lg:content-md:z-[1]']));
      expect(name('wide')).not.toContain('lg:sticky');
    });
  });

  describe('pinnedCap', () => {
    // `name` is 280px with no `minSize` of its own: its least width is a text column's 120.
    const byId = (options: GridLayoutOptions, columns = COLUMNS) =>
      Object.fromEntries(layoutOf(columns, options).columns.map(column => [column.id, column]));

    it('draws the first data column at the cap and counts the pinned block from it', () => {
      const layout = layoutOf(COLUMNS, { pinFirstColumn: 'desktop', pinnedCap: 230.7 });
      const columns = Object.fromEntries(layout.columns.map(column => [column.id, column]));
      expect(columns.name?.size).toBe(230);
      // The gradient, the filters panel and the header read this number: it is the block as drawn.
      expect(layout.pinnedLeft).toBe(48 + 230);
      // Only the pinned column is capped: `owner` keeps its designed 200 under a cap of 230.
      expect(columns.owner?.size).toBe(200);
      expect(columns.select?.size).toBe(48);
    });

    it('never draws the column below its own least width, nor above its designed one', () => {
      expect(byId({ pinnedCap: 60 }).name?.size).toBe(120);
      const withMin = COLUMNS.map(column => (column.id === 'name' ? { ...column, minSize: 148 } : column));
      expect(byId({ pinnedCap: 60 }, withMin).name?.size).toBe(148);
      expect(byId({ pinnedCap: 900 }).name?.size).toBe(280);
    });

    it('caps the width the viewer gave the column too', () => {
      expect(byId({ sizing: { name: 400 }, pinnedCap: 250 }).name?.size).toBe(250);
      expect(byId({ sizing: { name: 180 }, pinnedCap: 250 }).name?.size).toBe(180);
    });

    it('caps the first data column the viewer shows, whatever the designed order', () => {
      expect(byId({ order: ['owner', 'name'], pinnedCap: 150 }).owner).toMatchObject({ pin: 'left', size: 150 });
    });
  });

  it('keeps a column that cannot be hidden, whatever the stored layout hides', () => {
    const kept = COLUMNS.map(column => (column.id === 'name' ? { ...column, enableHiding: false } : column));
    expect(layoutOf(kept, { hidden: ['name', 'owner'] }).columns.map(column => column.id)).toEqual([
      'select',
      'name',
      'more',
    ]);
  });
});

describe('createGridScrollController', () => {
  /** A scroll event's shape, as far as the controller reads it. */
  function scrollEventOn(element: HTMLDivElement) {
    return { currentTarget: element } as unknown as UIEvent<HTMLDivElement>;
  }

  it('keeps the header at the body position, and the body at the header position', () => {
    const controller = createGridScrollController(false);
    const header = document.createElement('div');
    const body = document.createElement('div');
    controller.setHeaderViewport(header);
    controller.setViewport(body);

    body.scrollLeft = 120;
    controller.onViewportScroll(scrollEventOn(body));
    expect(header.scrollLeft).toBe(120);

    // The header scrolled by itself: a control inside it was focused or scrolled into view.
    header.scrollLeft = 40;
    controller.onHeaderScroll(scrollEventOn(header));
    expect(body.scrollLeft).toBe(40);
  });

  it('reports the left edge once the body is scrolled away from its start', () => {
    const controller = createGridScrollController(false);
    const body = document.createElement('div');
    controller.setViewport(body);
    expect(controller.edges.get() & 1).toBe(0);
    body.scrollLeft = 10;
    controller.onViewportScroll(scrollEventOn(body));
    expect(controller.edges.get() & 1).toBe(1);
  });
});

describe('DataTable grid layout', () => {
  it('draws the next page’s loading rows once, as grid rows: the footer adds none of its own', () => {
    const { container } = render(<GridLoadingMore />);
    // The loaded rows and the two loading rows the body draws; the footer's own two would make it two more.
    expect(rowSlots(container)).toBe(ITEMS.length + 2);
  });

  it('is the grid at every width: no card form in the tree, nothing hidden by a breakpoint', () => {
    const { container } = render(<Grid />);
    for (const part of ['data-grid-body', 'data-grid-header', 'data-grid-meta']) {
      // `hidden` as a class of its own (not `overflow-hidden`), or anything switched at `md`.
      expect(openingTag(container, part)).not.toMatch(/[\s"]hidden[\s"]|content-md:/);
    }
    // Each row is drawn once, as grid cells: the card cell (`cell`) of a column with a `gridCell` is not drawn.
    expect(screen.getByText('grid:Alpha')).toBeTruthy();
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getAllByRole('checkbox', { name: 'Select row' })).toHaveLength(ITEMS.length);
  });

  it('pins the action columns at every width, and the left block on a desktop with room for it only', () => {
    const { container } = render(<Grid />);
    const [row] = gridBodyMarkup(container).split('group/gridrow').slice(1);
    const cells = [...(row ?? '').matchAll(/class="([^"]*\bh-12\b[^"]*)"/g)].map(match => match[1] ?? '');
    // select, name, owner, more.
    expect(cells).toHaveLength(4);
    const pin = (cell: string | undefined) =>
      /(^| )sticky( |$)/.test(cell ?? '')
        ? 'always'
        : /(^| )lg:content-md:sticky( |$)/.test(cell ?? '')
          ? 'desktop with room'
          : 'none';
    expect(cells.map(pin)).toEqual(['desktop with room', 'desktop with room', 'none', 'always']);
    // Never by the window alone (a desktop's narrow content column lays out as a phone's and must not pin), and never
    // by the content area alone (a tablet's page is 720px of content too).
    for (const cell of cells) expect(cell).not.toMatch(/(^| )(lg|content-md|content-lg):(sticky|z-\[1\])( |$)/);
    // The left gradient starts at the pinned block's edge only where the block is pinned.
    const root = openingTag(container, 'data-grid-root');
    expect(root).toContain('[--dt-pin-l:0px]');
    // The same two conditions as the cells: the window's `lg` and the content area's `md`.
    expect(root).toMatch(/ lg:content-md:\[--dt-pin-l:var\(--dt-pin-l-wide\)\]/);
    expect(root).not.toMatch(/ lg:\[--dt-pin-l:|content-lg:/);
  });

  it('leaves a cards table untouched: no grid form at all', () => {
    const { container } = render(<Grid layout="cards" />);
    expect(container.innerHTML).not.toContain('data-grid-body');
    expect(container.innerHTML).not.toContain('data-grid-header');
    expect(screen.queryByText('grid:Alpha')).toBeNull();
  });

  it('draws every grid cell 48px high and the plain text cell on one line', () => {
    const { container } = render(<Grid />);
    const gridBody = gridBodyMarkup(container);
    const cellBoxes = [...gridBody.matchAll(/class="(flex h-12 items-center border-b[^"]*)"/g)].map(match => match[1]);
    // 3 rows x (select, name, owner, more).
    expect(cellBoxes).toHaveLength(12);
    // A string cell (the owner column's grid form) is the default one-line text.
    expect(screen.getByText('grid:Ada').className).toContain('truncate');
  });

  it('joins the body to the header: the body drops its top edge under a grid header', () => {
    const { container } = render(<Grid />);
    expect(openingTag(container, 'data-grid-header')).toContain('peer/gridheader');
    expect(openingTag(container, 'data-grid-body')).toContain('peer-data-[grid-header]/gridheader:border-t-0');
  });

  it('in fixed-height mode is one viewport: the body has no scroller of its own', () => {
    const { container } = render(<Grid maxHeight={360} />);
    expect(container.innerHTML).toContain('--data-table-max-height: 360px');
    expect(openingTag(container, 'data-grid-body')).not.toContain('border');
    expect(openingTag(container, 'data-grid-header')).toContain('sticky top-0');
    // Four gradients, one per edge, around the one viewport.
    expect(gradientEdges(container)).toEqual(['left', 'right', 'top', 'bottom']);
    // Each is the design's shade: into the page's colour, darker than the rows, never into the rows' own fill.
    const shades = gradientStyles(container);
    expect(shades).toHaveLength(4);
    expect(shades.every(shade => shade.includes('var(--color-bg) 100%'))).toBe(true);
  });

  it('draws loading rows as grid rows: one bar per data cell, none in the utility cells', () => {
    const { container } = render(<Grid loading />);
    const gridBody = gridBodyMarkup(container);
    const rows = gridBody.split('aria-hidden="true" data-loading-item').slice(1);
    expect(rows).toHaveLength(2);
    // name + owner.
    expect((rows[0]?.match(/w-3\/4/g) ?? []).length).toBe(2);
  });

  it('names no column while loading: a bar in each data header cell, no sort control, no resize handle', () => {
    const { container } = render(<Grid loading />);
    const header = gridHeaderMarkup(container);
    // name + owner.
    expect(header.match(/data-grid-header-loading/g)).toHaveLength(2);
    expect(header).not.toContain('>Name<');
    expect(header).not.toContain('>Owner<');
    expect(header).not.toContain('data-grid-resize-handle');
    expect(header).not.toContain('cursor-pointer');
    // "Select all" is no column name, and its place does not depend on the columns: it stays.
    expect(header).toContain('Select all rows');
  });

  it('names no column in a page loading scope either, with no loading prop of its own', () => {
    const { container } = render(
      <LoadingScope bare>
        <Grid />
      </LoadingScope>,
    );
    expect(gridHeaderMarkup(container).match(/data-grid-header-loading/g)).toHaveLength(2);
  });

  it('names its columns once loaded', () => {
    const { container } = render(<Grid />);
    const header = gridHeaderMarkup(container);
    expect(header).not.toContain('data-grid-header-loading');
    expect(header).toContain('>Name<');
    expect(header).toContain('>Owner<');
  });

  it('repaints a row checkbox when only the selection changes (rows are memoised)', () => {
    render(<Grid />);
    expect(gridRowCheckbox(1).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(gridRowCheckbox(1));
    expect(gridRowCheckbox(1).getAttribute('aria-checked')).toBe('true');
    expect(gridRowCheckbox(0).getAttribute('aria-checked')).toBe('false');
  });

  it('checks "select all" only when every row is selected', () => {
    render(<Grid />);
    const selectAll = () => screen.getByRole('checkbox', { name: 'Select all rows' });
    fireEvent.click(gridRowCheckbox(0));
    fireEvent.click(gridRowCheckbox(1));
    expect(selectAll().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(gridRowCheckbox(2));
    expect(selectAll().getAttribute('aria-checked')).toBe('true');
    fireEvent.click(selectAll());
    expect(gridRowCheckbox(0).getAttribute('aria-checked')).toBe('false');
  });

  it('a checkbox inside a row link toggles and does not follow the link', () => {
    render(<Grid />);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(gridRowCheckbox(0), event);
    expect(gridRowCheckbox(0).getAttribute('aria-checked')).toBe('true');
    expect(event.defaultPrevented).toBe(true);
  });

  it('an action button inside a row link does not follow the link; a plain cell does', () => {
    render(<Grid />);
    const onAction = new MouseEvent('click', { bubbles: true, cancelable: true });
    const buttons = screen.getAllByRole('button', { name: 'More' });
    expect(buttons).toHaveLength(ITEMS.length);
    const gridButton = buttons[0];
    if (!gridButton) throw new Error('no grid action button');
    fireEvent(gridButton, onAction);
    expect(onAction.defaultPrevented).toBe(true);

    const onCell = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(screen.getByText('grid:Ada'), onCell);
    expect(onCell.defaultPrevented).toBe(false);
  });

  /** A column's width as the grid's root states it (its CSS variable), in px. */
  function columnWidth(container: HTMLElement, index: number): number {
    return Number(new RegExp(`--dtc${index}-w: (\\d+)px`).exec(container.innerHTML)?.[1]);
  }

  it('states every column width once, on the root, and reads it in the cells', () => {
    const { container } = render(<Grid />);
    // select 48, name 280, owner 200, more 56.
    expect([0, 1, 2, 3].map(index => columnWidth(container, index))).toEqual([48, 280, 200, 56]);
    expect(container.innerHTML).toContain('width: var(--dtc1-w)');
    expect(container.innerHTML).toContain('--dt-pin-l-wide: 328px');
  });

  it('resizes a column from its handle with the arrow keys, down to its minimum', () => {
    const { container } = render(<Grid />);
    const handle = screen.getByRole('separator', { name: 'Resize Owner column' });

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(columnWidth(container, 2)).toBe(216);
    // No other column moves.
    expect(columnWidth(container, 1)).toBe(280);

    for (let press = 0; press < 20; press += 1) fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    // A text column never goes under 120px.
    expect(columnWidth(container, 2)).toBe(120);
  });

  it('gives utility columns no resize handle', () => {
    render(<Grid />);
    // name and owner only: the selection and action columns keep their width.
    expect(screen.getAllByRole('separator')).toHaveLength(2);
  });

  it('places every resize handle against its own header cell at every width, the pinned first column included', () => {
    const { container } = render(<Grid />);
    // The header cells of the data columns, by column id: each one holds a resize handle.
    const cells = new Map(
      [
        ...gridHeaderMarkup(container).matchAll(
          /<div class="([^"]*)"[^>]*data-grid-header-cell="true"[^>]*data-grid-col="([^"]+)"/g,
        ),
      ].map(match => [match[2] ?? '', (match[1] ?? '').split(' ')] as const),
    );
    expect([...cells.keys()]).toEqual(['name', 'owner']);
    expect(screen.getAllByRole('separator')).toHaveLength(cells.size);
    // A positioned box with no breakpoint on it: the left pin's `lg:content-md:sticky` is not one on a tablet, a
    // phone or in a narrow content column, where the handle would be placed against the header's frame instead.
    for (const classes of cells.values()) {
      expect(classes.some(name => name === 'relative' || name === 'sticky')).toBe(true);
    }
    // The first data column is the pinned one, and it still pins where there is room.
    expect(cells.get('name')).toContain('lg:content-md:sticky');
  });

  it('marks the column being dragged, and clears the mark on release', () => {
    const { container } = render(<Grid />);
    const handle = screen.getByRole('separator', { name: 'Resize Owner column' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 500, pointerId: 1 });
    expect(container.innerHTML).toContain('--dtc2-g: 1');
    fireEvent.pointerUp(handle, { pointerId: 1 });
    // Every cell reads the variable; only the root sets it, and only during the drag.
    expect(container.innerHTML).not.toContain('--dtc2-g: 1');
  });

  it('follows the pointer while a handle is dragged and keeps the last position on release', () => {
    const { container } = render(<Grid />);
    const handle = screen.getByRole('separator', { name: 'Resize Owner column' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 520, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 540, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    // 200 + 40: the moves of one frame are one write, and the release writes what is pending.
    expect(columnWidth(container, 2)).toBe(240);
  });

  it('ends a drag whose pointer capture is lost, with no release to follow', () => {
    const { container } = render(<Grid />);
    const handle = screen.getByRole('separator', { name: 'Resize Owner column' });
    fireEvent.pointerDown(handle, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 540, pointerId: 1 });
    fireEvent.lostPointerCapture(handle, { pointerId: 1 });
    expect(container.innerHTML).not.toContain('--dtc2-g: 1');
    expect(columnWidth(container, 2)).toBe(240);
    // The drag is over: the pointer no longer moves the column.
    fireEvent.pointerMove(handle, { clientX: 700, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(columnWidth(container, 2)).toBe(240);
  });

  it('measures a fill table before its first paint: it is never drawn at the fallback height', () => {
    const { container } = render(<Grid maxHeight="fill" />);
    // jsdom has no layout: the table's top is 0 and the window is 768px high, so the height left is the window's.
    // What matters is that the first committed markup already holds a measured height, not `70dvh`.
    expect(container.innerHTML).toContain(`--data-table-max-height: ${window.innerHeight}px`);
    expect(container.innerHTML).not.toContain('70dvh');
  });

  it('keeps the results row one line high when it has no count to show', () => {
    const { container } = render(<Grid items={[]} />);
    const meta = openingTag(container, 'data-grid-meta');
    // No rows: `DataTable.RowCount` draws nothing, and the row still reserves its line.
    expect(meta).toContain('min-h-[calc(1lh+var(--spacing-system-xxs))]');
    expect(meta).toContain('text-h6');
    expect(screen.queryByText(/results?$/)).not.toBeInTheDocument();
  });

  it('shows an applied sort on the header: primary label, direction arrow', () => {
    const { container } = render(<Grid />);
    const label = () => screen.getByText('Name');
    expect(label().className).toContain('text-ods-text-secondary');
    fireEvent.click(label());
    expect(label().className).toContain('text-ods-text-primary');
    // One line, never wrapped.
    expect(label().className).toContain('whitespace-nowrap');
    expect(container.innerHTML).toContain('text-ods-accent');
  });
});

describe('DataTable grid layout, pinFirstColumn="desktop"', () => {
  /** The pin of each body cell of the first row and of the header row: `window`, `window and content`, `always` or `none`. */
  function pins(markup: string): string[] {
    const [row] = markup.split('group/gridrow').slice(1);
    return [...(row ?? '').matchAll(/class="([^"]*\bh-12\b[^"]*)"/g)].map(match => pinOf(match[1]));
  }
  function pinOf(cell: string | undefined): string {
    const classes = (cell ?? '').split(' ');
    if (classes.includes('sticky')) return 'always';
    if (classes.includes('lg:sticky')) return 'window';
    if (classes.includes('lg:content-md:sticky')) return 'window and content';
    return 'none';
  }

  it('pins the left block on a desktop window whatever the content width: header, body and loading rows', () => {
    const { container } = render(<Grid pinFirstColumn="desktop" />);
    expect(pins(gridBodyMarkup(container))).toEqual(['window', 'window', 'none', 'always']);
    const header = [...gridHeaderMarkup(container).matchAll(/class="([^"]*\bh-12\b[^"]*)"/g)].map(match =>
      pinOf(match[1]),
    );
    expect(header).toEqual(['window', 'window', 'none', 'always']);
    const root = openingTag(container, 'data-grid-root');
    expect(root).toMatch(/ lg:\[--dt-pin-l:var\(--dt-pin-l-wide\)\]/);
    expect(root).not.toContain('content-md:');

    // The loading rows draw the same pins, or their first cell would scroll away under a pinned header.
    const { container: loading } = render(<Grid pinFirstColumn="desktop" loading />);
    const skeleton = gridBodyMarkup(loading).split('data-loading-item')[1] ?? '';
    const cells = [...skeleton.matchAll(/class="([^"]*\bh-12\b[^"]*)"/g)].map(match => pinOf(match[1]));
    expect(cells).toEqual(['window', 'window', 'none', 'always']);
  });

  describe('the cap on a desktop window', () => {
    let rootWidth = 500;
    let desktop = true;
    const observers: Array<() => void> = [];
    const originals = {
      matchMedia: window.matchMedia,
      ResizeObserver: window.ResizeObserver,
      clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
    };

    beforeEach(() => {
      rootWidth = 500;
      desktop = true;
      observers.length = 0;
      window.matchMedia = (query: string) =>
        ({
          matches: desktop,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList;
      window.ResizeObserver = class {
        constructor(private readonly callback: () => void) {}
        observe() {
          observers.push(() => this.callback());
        }
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return this.hasAttribute('data-grid-root') ? rootWidth : 0;
        },
      });
    });

    afterEach(() => {
      window.matchMedia = originals.matchMedia;
      window.ResizeObserver = originals.ResizeObserver;
      if (originals.clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originals.clientWidth);
    });

    const rootStyle = (container: HTMLElement) => openingTag(container, 'data-grid-root');

    it('draws the first data column at 40% of the table, header and body from one variable, before the first paint', () => {
      const { container } = render(<Grid pinFirstColumn="desktop" />);
      // 40% of 500. Measured in a layout effect, so this is the first markup the browser would paint.
      expect(rootStyle(container)).toContain('--dtc1-w: 200px');
      expect(rootStyle(container)).toContain('--dt-pin-l-wide: 248px');
      // Header and body cells read the column's width from the root, never a number of their own.
      expect(gridHeaderMarkup(container)).toContain('width: var(--dtc1-w)');
      expect(gridBodyMarkup(container)).toContain('width: var(--dtc1-w)');
    });

    it('follows the table width without rendering a row again', () => {
      let gridCellRenders = 0;
      const counted: ColumnDef<Item>[] = COLUMNS.map(column =>
        column.id === 'owner'
          ? {
              ...column,
              meta: {
                gridCell: ({ row }) => {
                  gridCellRenders += 1;
                  return `grid:${row.original.owner}`;
                },
              },
            }
          : column,
      );
      function CountedGrid() {
        const table = useDataTable<Item>({ data: ITEMS, columns: counted, getRowId: item => item.id });
        return (
          <DataTable table={table} layout="grid" pinFirstColumn="desktop">
            <DataTable.Header />
            <DataTable.Body<Item> />
          </DataTable>
        );
      }
      const { container } = render(<CountedGrid />);
      const rendersAfterMount = gridCellRenders;

      rootWidth = 600;
      act(() => {
        for (const notify of observers) notify();
      });
      expect(rootStyle(container)).toContain('--dtc1-w: 240px');
      // The geometry changed on the root alone: no row was drawn again for it.
      expect(gridCellRenders).toBe(rendersAfterMount);

      // A wide table: the column is at its designed width, and a wider table changes nothing.
      rootWidth = 1000;
      act(() => {
        for (const notify of observers) notify();
      });
      expect(rootStyle(container)).toContain('--dtc1-w: 280px');
      rootWidth = 1400;
      act(() => {
        for (const notify of observers) notify();
      });
      expect(rootStyle(container)).toContain('--dtc1-w: 280px');
      expect(gridCellRenders).toBe(rendersAfterMount);
    });

    it('leaves the width alone on a tablet and a phone, where the column scrolls', () => {
      desktop = false;
      const { container } = render(<Grid pinFirstColumn="desktop" />);
      expect(rootStyle(container)).toContain('--dtc1-w: 280px');
      expect(rootStyle(container)).toContain('--dt-pin-l-wide: 328px');
    });

    it('never caps a table on the shared rule', () => {
      const { container } = render(<Grid />);
      expect(rootStyle(container)).toContain('--dtc1-w: 280px');
    });
  });
});

describe('DataTable fill height under the floating composer dock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** The page's scroller as `AppLayout` draws it: padded by the dock it lies under, which it is told the height of. */
  function Page({ dock }: { dock: number }) {
    return (
      <ComposerDockHeightContext.Provider value={dock}>
        <main data-testid="scroller" style={{ overflowY: 'auto', paddingBottom: `${dock}px` }}>
          <Grid maxHeight="fill" />
        </main>
      </ComposerDockHeightContext.Provider>
    );
  }

  // CU-17tkuw6633f: the dock's height now lands inside the dock's own ResizeObserver delivery. `<main>` is its sibling,
  // so a table watching `<main>`'s content box left a notification undelivered there (the "ResizeObserver loop" error).
  it("re-measures when the dock's height changes, watching the scroller's border box", () => {
    const observed: Array<{ target: Element; options?: ResizeObserverOptions }> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(target: Element, options?: ResizeObserverOptions) {
          observed.push({ target, options });
        }
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.testid === 'scroller' ? 1000 : 0;
    });
    const { container, rerender } = render(<Page dock={143} />);
    expect(container.innerHTML).toContain('--data-table-max-height: 857px');

    // No observer fires: the new padding is measured in the commit that set it.
    rerender(<Page dock={207} />);
    expect(container.innerHTML).toContain('--data-table-max-height: 793px');

    // Watched once, on its border box: not observed again when the dock changes (a new observation made inside the
    // dock's delivery is one more at the same depth).
    const scroller = screen.getByTestId('scroller');
    expect(observed.filter(entry => entry.target === scroller).map(entry => entry.options)).toEqual([
      { box: 'border-box' },
    ]);
  });
});
