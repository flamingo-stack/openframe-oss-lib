import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { type UIEvent, useState } from 'react';
import { describe, expect, it } from 'vitest';
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
} from '../components/ui/data-table/data-table-grid';
import { useDataTable } from '../components/ui/data-table/use-data-table';

/**
 * The grid layout (`<DataTable layout="grid">`). jsdom has no layout, so what is locked here is the structure and the
 * state: the column order and pinning rule, both forms of the body being in the tree (CSS picks one, so the first
 * render is the same at every width), the classes that make a row 48px and one line, selection on memoised rows, and
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
}: {
  items?: Item[];
  layout?: 'grid' | 'cards';
  loading?: boolean;
  maxHeight?: number;
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
    <DataTable table={table} layout={layout} maxHeight={maxHeight}>
      <DataTable.Meta>
        <DataTable.RowCount />
      </DataTable.Meta>
      <DataTable.Header sort={sort} onSortChange={id => setSort({ id, desc: sort?.id === id ? !sort.desc : false })} />
      <DataTable.Body<Item> loading={loading} skeletonRows={2} rowHref={item => `/items/${item.id}`} />
    </DataTable>
  );
}

/** The opening tag of the element carrying `marker` (an attribute or a class), read off the markup. */
function openingTag(container: HTMLElement, marker: string): string {
  return new RegExp(`<[a-z]+[^>]*${marker}[^>]*>`).exec(container.innerHTML)?.[0] ?? '';
}

/** The markup of the grid form of the body (from its opening tag on). */
function gridBodyMarkup(container: HTMLElement): string {
  return container.innerHTML.slice(container.innerHTML.indexOf('data-grid-body'));
}

/** Which edges have a gradient, in document order. */
function gradientEdges(container: HTMLElement): string[] {
  return [...container.innerHTML.matchAll(/data-grid-gradient="(\w+)"/g)].map(match => match[1] ?? '');
}

/** Every checkbox of the table's rows, in document order: the card form's rows first, then the grid form's. */
function gridRowCheckbox(index: number, rowCount = ITEMS.length): HTMLElement {
  const all = screen.getAllByRole('checkbox', { name: 'Select row' });
  const checkbox = all[rowCount + index];
  if (!checkbox) throw new Error(`no grid checkbox ${index}`);
  return checkbox;
}

describe('buildGridLayout', () => {
  function layoutOf(columns: ColumnDef<Item>[]) {
    return renderHook(() => {
      const table = useDataTable<Item>({ data: ITEMS, columns });
      return buildGridLayout(table.getVisibleFlatColumns());
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
  it('keeps both forms of the body in the tree: card rows below md, the grid from md', () => {
    const { container } = render(<Grid />);
    // No breakpoint is read in JS: the card form is hidden from md and the grid form shown from md, by class.
    expect(container.innerHTML).toContain('class="content-md:hidden"');
    expect(openingTag(container, 'data-grid-body')).toMatch(/\bhidden\b.*\bcontent-md:block\b/);
    expect(openingTag(container, 'data-grid-header')).toMatch(/\bhidden\b.*\bcontent-md:block\b/);
    expect(openingTag(container, 'data-grid-meta')).toMatch(/\bhidden\b.*\bcontent-md:flex\b/);
    // The grid form draws the grid cells; the card form keeps the plain ones.
    expect(screen.getByText('grid:Alpha')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
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
  });

  it('draws loading rows as grid rows: one bar per data cell, none in the utility cells', () => {
    const { container } = render(<Grid loading />);
    const gridBody = gridBodyMarkup(container);
    const rows = gridBody.split('aria-hidden="true" data-loading-item').slice(1);
    expect(rows).toHaveLength(2);
    // name + owner.
    expect((rows[0]?.match(/w-3\/4/g) ?? []).length).toBe(2);
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
    // The grid form's buttons come after the card form's.
    const buttons = screen.getAllByRole('button', { name: 'More' });
    const gridButton = buttons[ITEMS.length];
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
    expect(container.innerHTML).toContain('--dt-pin-l: 328px');
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
