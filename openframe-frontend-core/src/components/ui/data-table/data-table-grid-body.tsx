'use client';

import { useContext, useSyncExternalStore, type ReactNode } from 'react';
import { useIsomorphicLayoutEffect } from '../../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../../utils/cn';
import { LoadingFallback } from '../../loading/loading-fallback';
import { LoadingRegion } from '../../loading/loading-region';
import { LoadingItems, useLoadingScope } from '../loading-scope';
import { useDataTableContext } from './data-table';
import type { DataTableBodyProps } from './data-table-body';
import { DataTableEmpty } from './data-table-empty';
import {
  GRID_PIN_LEFT_VAR,
  GRID_PIN_RIGHT_VAR,
  gridCellStyle,
  GridGradient,
  useGridScroll,
  useGridScrollElements,
  type GridLayout,
} from './data-table-grid';
import { useGridStructure } from './data-table-grid-prefs';
import { DataTableGridRow } from './data-table-grid-row';
import { DataTableLoadMoreContext } from './data-table-load-more';
import { DATA_TABLE_SKELETON_ROWS, dataTablePageSize } from './utils';

/** Server snapshot: no page is loading during a server render. */
const getNoRows = () => 0;

/** Server snapshot: the header tells the body it is drawn from a layout effect, which a server render does not run. */
const getNoHeader = () => false;

/** A grid row's height in px: what a `minRows` pad reserves per missing row. */
const GRID_ROW_HEIGHT = 48;

/**
 * The rows' stack. The last row drops its bottom divider: the block's own border closes the table there, and the two
 * together would read as a 2px line.
 */
const GRID_STACK_CLASS = '[&>*:last-child>*]:border-b-0';

/**
 * The empty state's message: as wide as the VISIBLE table and kept in view while the columns scroll sideways, like a
 * sub-row (`GRID_SUB_ROW_CLASS`): `w-0` adds nothing to its box's `w-max` width, the `min-width` is the viewport's
 * width and never more than the box. No z-index: the scroll gradients lie over it, as they lie over rows.
 */
const GRID_EMPTY_MESSAGE_CLASS = 'sticky left-0 w-0 min-w-[min(100%,var(--dt-viewport-w,100%))]';

/**
 * The body of a grid table, at every width. The same states as the card body, re-laid: loading rows are 48px grid rows, the empty state sits inside the bordered block, `minRows` pads with
 * 48px rows. `compact`, `rowHeightClassName` and `rowClassName` are card-row options and are not read here.
 */
export function DataTableGridBody<T = unknown>({
  loading: loadingProp,
  loadingCells = false,
  emptyMessage,
  emptyState,
  skeletonRows: skeletonRowsProp,
  loadingRegion = true,
  className,
  onRowClick,
  rowHref,
  minRows,
  renderSubRow,
  loadingSubRows = false,
}: DataTableBodyProps<T>) {
  const table = useDataTableContext<T>();
  const scroll = useGridScroll();
  const { viewportRef, onViewportScroll } = useGridScrollElements();
  const inScope = useLoadingScope();
  const loadMore = useContext(DataTableLoadMoreContext);
  const loadMorePageSize = useSyncExternalStore(loadMore.subscribe, loadMore.getSkeletonRows, getNoRows);
  const headerDrawn = useSyncExternalStore(
    scroll.controller.header.subscribe,
    scroll.controller.header.get,
    getNoHeader,
  );
  const visibleColumns = table.getVisibleFlatColumns();
  const layout = useGridStructure(visibleColumns);

  const loading = inScope || loadingProp;
  const rows = table.getRowModel().rows;
  const hasRows = rows.length > 0;
  // A grid table has no card body beside this one, so this body is the one that tells `<DataTable.InfiniteFooter>`
  // its rows continue here. Without it the footer draws its own load-more rows too, as card rows under the grid.
  useIsomorphicLayoutEffect(() => (hasRows ? loadMore.registerRowsBody() : undefined), [loadMore, hasRows]);
  const skeletonRows =
    skeletonRowsProp ?? dataTablePageSize(table) ?? (minRows && minRows > 0 ? minRows : DATA_TABLE_SKELETON_ROWS);

  let content: ReactNode;
  if (loading && loadingCells && hasRows) {
    content = (
      <LoadingFallback label="Loading results" status={loadingRegion && !inScope} className={GRID_STACK_CLASS}>
        {rows.map(row => (
          <DataTableGridRow<T>
            key={row.id}
            row={row}
            layout={layout}
            drawsCells
            subRow={loadingSubRows ? renderSubRow?.(row.original) : undefined}
            data-loading-item
          />
        ))}
      </LoadingFallback>
    );
  } else if (loading && !hasRows) {
    content = (
      <LoadingRegion label="Loading results" announce={loadingRegion && !inScope} className={GRID_STACK_CLASS}>
        <LoadingItems count={skeletonRows}>
          {() => <DataTableGridRow row={null} layout={layout} data-loading-item />}
        </LoadingItems>
      </LoadingRegion>
    );
  } else if (!hasRows) {
    const empty = emptyState ? (
      <DataTableEmpty {...emptyState} />
    ) : emptyMessage != null ? (
      <DataTableEmpty title={emptyMessage} description={undefined} />
    ) : (
      <DataTableEmpty />
    );
    // The empty state is not a row, but under a header the body stays as wide as the columns: the header scrolls with
    // it (in page mode it is kept at the body's `scrollLeft`), so a body only one viewport wide would leave every header
    // cell past the right edge out of reach, an applied filter included. The zero-height row of the columns gives the
    // box their width; with no header drawn there is nothing to reach and the box stays one viewport wide. The message
    // is one viewport wide and sticky, so it stays in view however far the box scrolls. Both sit in one `w-max` box
    // because a sticky element moves only inside its parent, and a plain block is one viewport wide.
    content = (
      <div data-grid-empty className="w-max min-w-full">
        {headerDrawn && <GridBlankRow layout={layout} />}
        <div
          className={cn('flex items-center justify-center bg-ods-card', GRID_EMPTY_MESSAGE_CLASS)}
          style={minRows ? { minHeight: minRows * GRID_ROW_HEIGHT } : undefined}
        >
          {empty}
        </div>
      </div>
    );
  } else {
    // Load-more rows are row slots too, so they count against `minRows`.
    const padCount = minRows ? Math.max(0, minRows - rows.length - loadMorePageSize) : 0;
    content = (
      <div className={GRID_STACK_CLASS}>
        {rows.map(row => {
          const item = row.original;
          return (
            <DataTableGridRow<T>
              key={row.id}
              row={row}
              layout={layout}
              onClick={onRowClick}
              href={rowHref?.(item) ?? undefined}
              selected={row.getIsSelected()}
              subRow={renderSubRow?.(item)}
              data-loading-item
            />
          );
        })}
        {loadMorePageSize > 0 && (
          <LoadingItems count={loadMorePageSize}>
            {() => <DataTableGridRow row={null} layout={layout} data-loading-item />}
          </LoadingItems>
        )}
        {padCount > 0 && <GridPadRows count={padCount} layout={layout} />}
      </div>
    );
  }

  if (scroll.mode === 'fixed') {
    // The table's one viewport (the root's) scrolls: the body is just its rows.
    return (
      <div data-grid-body className={className}>
        {content}
      </div>
    );
  }

  return (
    <div
      data-grid-body
      className={cn(
        'relative overflow-hidden rounded-md border border-ods-border bg-ods-card',
        // Under a grid header the two are one block: the header keeps the top edge and corners.
        'peer-data-[grid-header]/gridheader:rounded-t-none peer-data-[grid-header]/gridheader:border-t-0',
        className,
      )}
    >
      {/* The horizontal scroller. Not an ancestor of the header, which is sticky to the page. */}
      <div ref={viewportRef} className="overflow-x-auto" onScroll={onViewportScroll}>
        {/* One stable child: the controller watches its size for rows arriving and leaving. */}
        <div>{content}</div>
      </div>
      <GridGradient edge="left" offset={GRID_PIN_LEFT_VAR} />
      <GridGradient edge="right" offset={GRID_PIN_RIGHT_VAR} />
    </div>
  );
}

/**
 * `minRows` in the grid: the missing rows' height, drawn as empty rows so the dividers and the fill carry on. They are
 * not rows being read, so they are not loading items.
 */
function GridPadRows({ count, layout }: { count: number; layout: GridLayout }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <GridBlankRow key={index} layout={layout} cellClassName="h-12 border-b border-ods-border bg-ods-card" />
      ))}
    </>
  );
}

/**
 * A row of the layout's columns with nothing in them, each as wide as its column and taking the free width the same
 * way. With no `cellClassName` it is zero high: it only gives its parent the columns' width (the empty state).
 */
function GridBlankRow({ layout, cellClassName }: { layout: GridLayout; cellClassName?: string }) {
  return (
    <div data-grid-blank-row aria-hidden="true" className="pointer-events-none flex w-max min-w-full">
      {layout.columns.map(column => (
        <div
          key={column.id}
          className={cn(
            cellClassName,
            column.kind === 'filler' ? 'flex-1' : column.grow ? 'flex-auto shrink-0' : 'flex-none',
          )}
          style={column.kind === 'filler' ? undefined : { width: gridCellStyle(column)?.width }}
        />
      ))}
    </div>
  );
}
