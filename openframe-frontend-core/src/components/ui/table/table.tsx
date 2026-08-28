'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '../../../utils/cn';
import { Chevron02RightIcon } from '../../icons-v2-generated';
import { Pagination } from '../../pagination';
import { Button } from '../button';
import { CursorPagination } from '../cursor-pagination';
import { TableEmptyState } from './table-empty-state';
import { TableHeader } from './table-header';
import { TableRow } from './table-row';
import { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE, TableCardSkeleton } from './table-skeleton';
import type { RowAction, TableColumn, TableProps, TableRowData } from './types';
import { useTableMotion } from './use-table-motion';

/**
 * Injects synthetic columns (row actions and/or row-level chevron link) at the end of the columns array.
 */
function injectSyntheticColumns<T>(
  columns: TableColumn<T>[],
  rowActions?: RowAction<T>[],
  renderRowActions?: (item: T) => ReactNode,
  rowHref?: (item: T) => string | null | undefined,
  actionsColumnWidth?: string,
): TableColumn<T>[] {
  const hasActions = Boolean(rowActions?.length) || Boolean(renderRowActions);
  const result = [...columns];
  // Captured OUTSIDE `renderCell` below. The cell renders long after this
  // function returns, so no narrowing of the optional `rowActions` parameter
  // survives into it; defaulting here keeps the render a plain array map.
  // `hasActions` guarantees this is non-empty whenever `renderRowActions` is
  // absent, so the `[]` fallback is the unreachable branch, not a silent drop.
  const actions = rowActions ?? [];

  if (hasActions) {
    const actionsColumn: TableColumn<T> = {
      key: '__actions__',
      label: '',
      // A caller-fixed width keeps the header and every row on ONE grid
      // (see `actionsColumnWidth` in types.ts); the default stays
      // content-sized for back-compat.
      width: actionsColumnWidth ?? 'min-w-[100px] w-auto shrink-0 flex-none',
      align: 'right',
      renderCell: (item: T) => (
        <div className="pointer-events-auto flex items-center justify-end gap-2" data-no-row-click>
          {renderRowActions
            ? renderRowActions(item)
            : actions.map((action, actionIndex) => (
                <Button
                  key={actionIndex}
                  variant="outline"
                  onClick={e => {
                    e.stopPropagation();
                    action.onClick(item);
                  }}
                  leftIcon={action.icon}
                  className={action.className}
                >
                  {action.label}
                </Button>
              ))}
        </div>
      ),
    };
    result.push(actionsColumn);
  }

  if (rowHref) {
    const chevronColumn: TableColumn<T> = {
      key: '__chevron__',
      label: '',
      width: 'w-12 shrink-0 flex-none',
      align: 'right',
      renderCell: (item: T) => {
        const href = rowHref(item);
        if (!href) return null;
        return (
          <div className="pointer-events-auto flex items-center justify-end" data-no-row-click>
            <Button
              href={href}
              prefetch={false}
              variant="outline"
              size="icon"
              leftIcon={<Chevron02RightIcon className="h-6 w-6" />}
              aria-label="View details"
            />
          </div>
        );
      },
    };
    result.push(chevronColumn);
  }

  return result;
}

/** @deprecated Use `DataTable` from `data-table` instead. */
export function Table<T = TableRowData>({
  data,
  columns,
  rowKey,
  loading = false,
  emptyMessage,
  skeletonRows = 10,
  className,
  containerClassName,
  headerClassName,
  rowClassName,
  compact,
  onRowClick,
  rowActions,
  renderRowActions,
  rowHref,
  sortBy,
  sortDirection,
  onSort,
  filters,
  onFilterChange,
  selectable,
  selectedRows = [],
  onSelectionChange,
  bulkActions,
  showToolbar,
  cursorPagination,
  pagePagination,
  paginationClassName,
  infiniteScroll,
  stickyHeader,
  stickyHeaderOffset,
  animateRowReorder,
  actionsColumnWidth,
}: TableProps<T>) {
  // Opt-in row-reorder animation: framer-motion is loaded lazily (its own chunk)
  // ONLY when `animateRowReorder` is set, so the default table stays motion-free.
  const tableMotion = useTableMotion(Boolean(animateRowReorder));
  const columnsWithActions = injectSyntheticColumns(columns, rowActions, renderRowActions, rowHref, actionsColumnWidth);
  const getRowHref = (item: T): string | undefined => {
    if (onRowClick || !rowHref) return undefined;
    return rowHref(item) ?? undefined;
  };
  const getRowKey = (item: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(item);
    }
    const key = item[rowKey];
    return key?.toString() || index.toString();
  };

  const getRowClassName = (item: T, index: number): string => {
    if (typeof rowClassName === 'function') {
      return rowClassName(item, index);
    }
    return rowClassName || '';
  };

  const isRowSelected = (item: T) => {
    if (!selectable || !selectedRows) return false;
    const key = getRowKey(item, -1);
    return selectedRows.some(row => getRowKey(row, -1) === key);
  };

  const handleSelectRow = (item: T) => {
    if (!onSelectionChange) return;

    const key = getRowKey(item, -1);
    const isSelected = isRowSelected(item);

    if (isSelected) {
      onSelectionChange(selectedRows.filter(row => getRowKey(row, -1) !== key));
    } else {
      onSelectionChange([...selectedRows, item]);
    }
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;

    if (selectedRows.length === data.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange([...data]);
    }
  };

  const allSelected = selectedRows.length > 0 && selectedRows.length === data.length;
  const someSelected = selectedRows.length > 0 && selectedRows.length < data.length;

  // Infinite scroll: IntersectionObserver on sentinel div
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Refreshed after every commit, declared before the observer effect so it
  // wins the same flush. Not in the render body: the reader is the
  // IntersectionObserver callback, which cannot fire before a commit.
  const onLoadMoreRef = useRef(infiniteScroll?.onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = infiniteScroll?.onLoadMore;
  });

  useEffect(() => {
    if (!infiniteScroll?.hasNextPage || infiniteScroll.isFetchingNextPage) return undefined;
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          onLoadMoreRef.current?.();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [infiniteScroll?.hasNextPage, infiniteScroll?.isFetchingNextPage]);

  return (
    <div className={cn('flex w-full flex-col gap-1', containerClassName)}>
      {/* Toolbar for bulk actions */}
      {showToolbar && bulkActions && selectedRows.length > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-[6px] border border-ods-border bg-ods-card p-3">
          <span className="text-ods-text-secondary text-h6">
            {selectedRows.length} item{selectedRows.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            {bulkActions.map((action, index) => (
              <button
                key={index}
                onClick={() => action.onClick(selectedRows)}
                disabled={action.requiresSelection && selectedRows.length === 0}
                className={cn(
                  'rounded border px-3 py-1.5 transition-colors text-h6',
                  'border-ods-border bg-ods-card text-ods-text-primary hover:bg-ods-bg-active',
                  action.className,
                )}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desktop Header */}
      <TableHeader
        columns={columnsWithActions}
        className={headerClassName}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={onSort}
        filters={filters}
        onFilterChange={onFilterChange}
        selectable={selectable}
        allSelected={allSelected}
        someSelected={someSelected}
        onSelectAll={handleSelectAll}
        totalItemsCount={data.length}
        stickyHeader={stickyHeader}
        stickyHeaderOffset={stickyHeaderOffset}
      />

      {/* Table Body */}
      <div className={cn('flex w-full flex-col gap-2', className)}>
        {loading && data.length === 0 ? (
          <TableCardSkeleton
            columns={columns}
            rows={skeletonRows}
            compact={compact}
            hasActions={(rowActions?.length ?? 0) > 0}
            hasChevron={Boolean(rowHref)}
          />
        ) : data.length === 0 ? (
          <TableEmptyState message={emptyMessage} />
        ) : (
          <>
            {/* Real data rows. When `animateRowReorder` is on, wrap ONLY these
                in a `LayoutGroup` so a reorder (same key, new order) animates via
                FLIP — the invisible placeholder rows below are intentionally left
                outside it. `AnimatePresence` is not needed here: the row set is
                stable across a reorder (no enter/exit); add it if a future task
                animates rows being added/removed. */}
            {(() => {
              const rows = data.map((item, index) => (
                <TableRow
                  key={getRowKey(item, index)}
                  item={item}
                  columns={columnsWithActions}
                  onClick={onRowClick}
                  href={getRowHref(item)}
                  className={getRowClassName(item, index)}
                  index={index}
                  compact={compact}
                  selectable={selectable}
                  selected={isRowSelected(item)}
                  onSelect={handleSelectRow}
                  animateRowReorder={animateRowReorder}
                  motionDiv={tableMotion?.motionDiv}
                />
              ));
              // LayoutGroup only once framer-motion has lazily resolved; until
              // then (and when off) rows render as plain `<div>`s.
              const LayoutGroup = tableMotion?.LayoutGroup;
              return animateRowReorder && LayoutGroup ? <LayoutGroup>{rows}</LayoutGroup> : rows;
            })()}
            {/* Infinite scroll: skeleton rows */}
            {infiniteScroll?.isFetchingNextPage && (
              <TableCardSkeleton
                columns={columns}
                rows={infiniteScroll.skeletonRows ?? 3}
                hasActions={(rowActions?.length ?? 0) > 0}
                hasChevron={Boolean(rowHref)}
              />
            )}
            {/* Infinite scroll: sentinel element */}
            {infiniteScroll?.hasNextPage && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
            {/* Invisible placeholder rows to maintain consistent table height (disabled for infinite scroll) */}
            {!infiniteScroll &&
              Array.from({ length: Math.max(0, skeletonRows - data.length) }).map((_, index) => (
                <div
                  key={`placeholder-${index}`}
                  className="pointer-events-none relative overflow-hidden rounded-[6px]"
                  aria-hidden="true"
                >
                  {/* Desktop placeholder - invisible but takes up space */}
                  <div className={cn('hidden items-center gap-4 px-4 py-0 md:flex', ROW_HEIGHT_DESKTOP)} />
                  {/* Mobile placeholder - invisible but takes up space */}
                  <div className={cn('flex items-center justify-start gap-3 px-3 py-0 md:hidden', ROW_HEIGHT_MOBILE)} />
                </div>
              ))}
          </>
        )}
      </div>

      {/* Pagination - only show when there's data and infinite scroll is not active */}
      {!infiniteScroll && cursorPagination && data.length > 0 && (
        <CursorPagination
          hasNextPage={cursorPagination.hasNextPage}
          hasPreviousPage={cursorPagination.hasPreviousPage}
          isFirstPage={cursorPagination.isFirstPage}
          startCursor={cursorPagination.startCursor}
          endCursor={cursorPagination.endCursor}
          currentCount={cursorPagination.currentCount ?? data.length}
          totalCount={cursorPagination.totalCount}
          itemName={cursorPagination.itemName}
          loading={loading}
          onNext={cursorPagination.onNext}
          onPrevious={cursorPagination.onPrevious}
          onReset={cursorPagination.onReset}
          showInfo={cursorPagination.showInfo ?? true}
          compact={cursorPagination.compact}
          resetButtonLabel={cursorPagination.resetButtonLabel}
          resetButtonIcon={cursorPagination.resetButtonIcon}
          className={cn('mt-2 border-t border-ods-border pt-3', paginationClassName)}
        />
      )}

      {!infiniteScroll && pagePagination && !cursorPagination && data.length > 0 && (
        <div className={cn('mt-2 border-t border-ods-border pt-3', paginationClassName)}>
          <Pagination
            currentPage={pagePagination.currentPage}
            totalPages={pagePagination.totalPages}
            onPageChange={pagePagination.onPageChange}
          />
        </div>
      )}
    </div>
  );
}
