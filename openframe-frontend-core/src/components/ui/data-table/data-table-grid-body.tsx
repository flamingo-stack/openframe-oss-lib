'use client';

import { useContext, useSyncExternalStore, type ReactNode } from 'react';
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

/** A grid row's height in px: what a `minRows` pad reserves per missing row. */
const GRID_ROW_HEIGHT = 48;

/**
 * The rows' stack. The last row drops its bottom divider: the block's own border closes the table there, and the two
 * together would read as a 2px line.
 */
const GRID_STACK_CLASS = '[&>*:last-child>*]:border-b-0';

/**
 * The body of a grid table, from `md` up (below it `DataTable.Body` draws the card rows). The same states as the card
 * body, re-laid: loading rows are 48px grid rows, the empty state sits inside the bordered block, `minRows` pads with
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
  const visibleColumns = table.getVisibleFlatColumns();
  const layout = useGridStructure(visibleColumns);

  const loading = inScope || loadingProp;
  const rows = table.getRowModel().rows;
  const hasRows = rows.length > 0;
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
    // The empty state is not a row: it stays in view whatever the columns' total width is.
    content = (
      <div
        className="sticky left-0 flex w-full items-center justify-center bg-ods-card"
        style={minRows ? { minHeight: minRows * GRID_ROW_HEIGHT } : undefined}
      >
        {empty}
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
      <div data-grid-body className={cn('hidden content-md:block', className)}>
        {content}
      </div>
    );
  }

  return (
    <div
      data-grid-body
      className={cn(
        'relative hidden overflow-hidden rounded-md border border-ods-border bg-ods-card content-md:block',
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
        <div key={index} aria-hidden="true" className="pointer-events-none flex w-max min-w-full">
          {layout.columns.map(column => (
            <div
              key={column.id}
              className={cn(
                'h-12 border-b border-ods-border bg-ods-card',
                column.kind === 'filler' ? 'flex-1' : column.grow ? 'flex-auto shrink-0' : 'flex-none',
              )}
              style={column.kind === 'filler' ? undefined : { width: gridCellStyle(column)?.width }}
            />
          ))}
        </div>
      ))}
    </>
  );
}
