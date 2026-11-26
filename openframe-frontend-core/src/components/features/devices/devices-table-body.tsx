'use client';

import { type ReactNode, useMemo, useState } from 'react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  type DataTableLayout,
  type DataTableSettings,
  type NoDataProps,
  type OnChangeFn,
  type RowSelectionState,
  selectionColumn,
  TABLE_PAGINATION_PENDING,
  type TablePagerState,
  useDataTable,
} from '../../ui';
import { DATA_TABLE_SKELETON_ROWS } from '../../ui/data-table/utils';
import { useDeviceStatusDisplay } from './device-status-display';
import { getDeviceOpenColumn, getDeviceTableColumns } from './devices-table-columns';
import { useDevicesViewConfig } from './devices-view-config';
import type { DeviceFilters, DeviceRow } from './types';

/**
 * The row above a devices table, as the host fills it: a paged list's pager, the wait for its next page, and the
 * controls at the row's right end. One prop for one row.
 */
export interface DevicesTableMetaRow {
  /**
   * A paged list's pager (`useCursorPager` `footerProps`): First · Previous · Next, with the page's range ("21–40 of
   * 340 devices") in place of the count. `null`: a paged list whose first page is being read (the pager waits).
   * Omitted: the list is not paged.
   */
  pager?: (TablePagerState & { rangeStart?: number }) | null;
  /** The pager's buttons wait: the next page is being read, and the rows on screen are the last page's. */
  loading?: boolean;
  /** The controls at the row's right end, after a divider when there is a pager: the auto-refresh picker. */
  actions?: ReactNode;
}

export interface DevicesTableBodyProps<T extends DeviceRow = DeviceRow> {
  devices: T[];
  isLoading?: boolean;
  /** The loading state announces itself ("Loading results"). `false` inside another loading region. Default `true`. */
  loadingRegion?: boolean;
  /**
   * The empty state, as the design's `data-placeholder`: icon over a title over
   * a description. Wins over `emptyMessage` when both are given.
   */
  emptyState?: NoDataProps;
  /** @deprecated Single-line variant of {@link emptyState}, pass `emptyState` instead. */
  emptyMessage?: string;
  skeletonRows?: number;
  stickyHeaderOffset?: string;
  /** Under the body: the infinite footer of a list read page after page. A paged list passes `metaRow.pager` instead. */
  footerSlot?: ReactNode;
  /** The row above the table: a paged list's pager and its wait, and the controls at its right end. */
  metaRow?: DevicesTableMetaRow;
  deviceFilters?: DeviceFilters | null;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  /** Optional extra column inserted before the open-in-new-tab column (e.g. row actions on the dedicated page). */
  actionsColumn?: ColumnDef<T>;
  /** Column ids to drop from the base table columns (e.g. ['organization'] when scoped to a single org). */
  hideColumns?: string[];
  /** Adds the USER and SOURCES columns, for a host whose tenant has directories. Default: neither. */
  directoryColumns?: boolean;
  /** Column ids whose header filter is dropped while the column stays visible (e.g. ['status'] on the archive page). */
  disableColumnFilters?: string[];
  /** The facet query is still in flight, see `getDeviceTableColumns`. */
  filtersPending?: boolean;
  /** Server-side total (for paginated lists). Falls back to loaded-row count when omitted. */
  totalCount?: number;
  /**
   * Render the column header. Default true.
   *
   * Pass `false` to drop it over a genuinely empty list, column labels above
   * nothing are noise, and the empty message reads better without a row of
   * headings it does not explain. Keep it `true` while loading (the skeleton
   * rows are the content it belongs to) and whenever the emptiness is the RESULT
   * of narrowing: the column funnels live in this header, so removing it would
   * strip the only way to undo the filter that emptied the table.
   */
  showHeader?: boolean;
  /**
   * The table's layout. `grid`: 48px one-line rows in one bordered block at every width, the action columns pinned
   * right, the device column pinned left on a desktop with at least 720px of content (it scrolls with the rest on a
   * tablet, a phone and in a narrower content column). Default `cards`.
   */
  layout?: DataTableLayout;
  /**
   * Grid layout: the table's height. `'fill'` takes the height the page leaves under the table's top, so the table
   * scrolls inside itself (sticky header, a gradient under it and above the bottom edge) and the page does not.
   * Omitted, the page scrolls.
   */
  tableMaxHeight?: number | string;
  /** Grid layout: the table's settings (the gear's menu of columns, the saved column layout). See `DataTable`. */
  tableSettings?: DataTableSettings;
  /**
   * Grid layout: draw the checkbox column first (the design's `table/utility-cell`, type checkbox). Off by default:
   * the devices list has nothing to do with a selection yet, and the design draws the column only on a table that
   * does. Card rows never draw it.
   */
  selectable?: boolean;
  /**
   * The selected rows, by row id, of a `selectable` grid table. Omit both to let the table keep the selection itself.
   */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
}

/** One page of rows still being read: an id each, and nothing a cell can show (every cell draws its loading form). */
function deviceLoadingRows<T extends DeviceRow>(count: number): T[] {
  // A row the table can key: the fields a device row requires, empty. The cells read nothing else.
  return Array.from({ length: count }, (_, index) => ({ id: `loading-${index}`, machineId: '', status: '' }) as T);
}

export function DevicesTableBody<T extends DeviceRow = DeviceRow>({
  devices,
  isLoading,
  loadingRegion,
  emptyState,
  emptyMessage = 'No devices found.',
  skeletonRows,
  stickyHeaderOffset,
  footerSlot,
  metaRow: metaRowGiven,
  deviceFilters,
  columnFilters,
  onColumnFiltersChange,
  actionsColumn,
  hideColumns,
  directoryColumns = false,
  disableColumnFilters,
  filtersPending,
  totalCount,
  showHeader = true,
  layout = 'cards',
  tableMaxHeight,
  tableSettings,
  selectable: selectableGiven = false,
  rowSelection: rowSelectionGiven,
  onRowSelectionChange,
}: DevicesTableBodyProps<T>) {
  // The grid's checkbox column, when the host asks for it: the selection is the host's when it passes one, the
  // table's own otherwise.
  const [ownRowSelection, setOwnRowSelection] = useState<RowSelectionState>({});
  const rowSelection = rowSelectionGiven ?? ownRowSelection;
  const selectable = selectableGiven && layout === 'grid';
  const { getDeviceHref } = useDevicesViewConfig();
  const statusDisplay = useDeviceStatusDisplay();
  const columns = useMemo<ColumnDef<T>[]>(() => {
    const hidden = new Set(hideColumns ?? []);
    const unfiltered = new Set(disableColumnFilters ?? []);
    const base = getDeviceTableColumns<T>(deviceFilters ?? null, filtersPending, {
      directoryColumns,
      // Without the customer column there is room for the sources from where the customer's column would have started.
      roomyDirectory: hidden.has('organization'),
      statusDisplay,
    })
      .filter(c => !c.id || !hidden.has(c.id))
      .map(c => (c.id && unfiltered.has(c.id) ? { ...c, meta: { ...c.meta, filter: undefined } } : c));
    const open = getDeviceOpenColumn<T>();
    const data = actionsColumn ? [...base, actionsColumn, open] : [...base, open];
    // The checkbox column is the grid table's first column.
    return selectable ? [selectionColumn<T>(), ...data] : data;
  }, [
    deviceFilters,
    filtersPending,
    actionsColumn,
    hideColumns,
    directoryColumns,
    disableColumnFilters,
    selectable,
    statusDisplay,
  ]);

  // While loading the table holds one page of empty rows, drawn with the real cells: every part of a row draws its
  // own loading form (`DataTable.Body`'s `loadingCells`), so a loading row is the loaded row's own layout.
  const loadingRows = useMemo(
    () => (isLoading ? deviceLoadingRows<T>(skeletonRows ?? DATA_TABLE_SKELETON_ROWS) : null),
    [isLoading, skeletonRows],
  );

  const pager = metaRowGiven?.pager;
  const pagerLoading = metaRowGiven?.loading ?? false;
  const metaActions = metaRowGiven?.actions;
  // An empty FIRST page has no pager (the empty state is the whole answer); an empty later page keeps it, so the way
  // back stays, even where the host hides the column header.
  const paged =
    pager !== undefined &&
    (pager === null || isLoading || pagerLoading || devices.length > 0 || !(pager.isFirstPage ?? true));
  const metaRow = (showHeader && layout === 'grid') || paged || (showHeader && !!metaActions);

  const table = useDataTable<T>({
    data: loadingRows ?? devices,
    columns,
    // `machineId` is EMPTY (not absent) while the agent is not connected: those rows key on their id.
    getRowId: row => String(row.machineId || row.id),
    enableSorting: false,
    // A row still being read cannot be selected.
    enableRowSelection: selectable && !loadingRows,
    state: { ...(columnFilters !== undefined ? { columnFilters } : {}), rowSelection },
    onColumnFiltersChange,
    onRowSelectionChange: onRowSelectionChange ?? setOwnRowSelection,
  });

  return (
    <DataTable
      table={table}
      layout={layout}
      maxHeight={layout === 'grid' ? tableMaxHeight : undefined}
      settings={layout === 'grid' ? tableSettings : undefined}
    >
      {/* The row above the table: the grid's results count (the card header carries its own in `rightSlot`), or on a
          paged list the page's range with the pager, and the host's controls. */}
      {metaRow && (
        <DataTable.Meta
          pagination={
            paged && (
              <DataTable.Pagination
                pager={pager ?? TABLE_PAGINATION_PENDING}
                loading={pager === null || isLoading || pagerLoading}
              />
            )
          }
          actions={metaActions}
        >
          {paged ? (
            <DataTable.PageRange
              itemName="device"
              rangeStart={pager?.rangeStart}
              totalCount={totalCount}
              hasNextPage={pager?.hasNextPage}
              loading={isLoading}
            />
          ) : (
            showHeader && <DataTable.RowCount itemName="device" totalCount={totalCount} loading={isLoading} />
          )}
        </DataTable.Meta>
      )}
      {showHeader && (
        <DataTable.Header
          stickyHeader={!!stickyHeaderOffset}
          stickyHeaderOffset={stickyHeaderOffset}
          rightSlot={
            metaRow ? undefined : <DataTable.RowCount itemName="device" totalCount={totalCount} loading={isLoading} />
          }
          loading={isLoading}
        />
      )}
      <DataTable.Body
        loading={isLoading}
        loadingCells
        loadingRegion={loadingRegion}
        skeletonRows={skeletonRows}
        emptyState={emptyState}
        emptyMessage={emptyState ? undefined : emptyMessage}
        rowClassName="mb-1"
        rowHref={getDeviceHref}
      />
      {footerSlot}
    </DataTable>
  );
}
