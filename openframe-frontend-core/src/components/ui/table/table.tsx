'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { cn } from '../../../utils/cn'
import { Chevron02RightIcon } from '../../icons-v2-generated'
import { Pagination } from '../../pagination'
import { Button } from '../button'
import { CursorPagination } from '../cursor-pagination'
import { TableEmptyState } from './table-empty-state'
import { TableHeader } from './table-header'
import { TableRow } from './table-row'
import { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE, TableCardSkeleton } from './table-skeleton'
import type { RowAction, TableColumn, TableProps } from './types'

/**
 * Injects synthetic columns (row actions and/or row-level chevron link) at the end of the columns array.
 */
function injectSyntheticColumns<T>(
  columns: TableColumn<T>[],
  rowActions?: RowAction<T>[],
  renderRowActions?: (item: T) => ReactNode,
  rowHref?: (item: T) => string | null | undefined,
): TableColumn<T>[] {
  const hasActions = Boolean(rowActions?.length) || Boolean(renderRowActions)
  const result = [...columns]

  if (hasActions) {
    const actionsColumn: TableColumn<T> = {
      key: '__actions__',
      label: '',
      width: 'min-w-[100px] w-auto shrink-0 flex-none',
      align: 'right',
      renderCell: (item: T) => (
        <div className="flex gap-2 items-center justify-end pointer-events-auto" data-no-row-click>
          {renderRowActions ? (
            renderRowActions(item)
          ) : (
            rowActions!.map((action, actionIndex) => (
              <Button
                key={actionIndex}
                variant='card'
                onClick={(e) => {
                  e.stopPropagation()
                  action.onClick(item)
                }}
                leftIcon={action.icon && action.label ? action.icon : undefined}
                centerIcon={action.icon && !action.label ? action.icon : undefined}
                className={action.className}
              >
                {action.label}
              </Button>
            ))
          )}
        </div>
      ),
    }
    result.push(actionsColumn)
  }

  if (rowHref) {
    const chevronColumn: TableColumn<T> = {
      key: '__chevron__',
      label: '',
      width: 'w-12 shrink-0 flex-none',
      align: 'right',
      renderCell: (item: T) => {
        const href = rowHref(item)
        if (!href) return null
        return (
          <div className="flex items-center justify-end pointer-events-auto" data-no-row-click>
            <Button
              href={href}
              prefetch={false}
              variant="outline"
					    size="icon"
              centerIcon={<Chevron02RightIcon className="w-6 h-6" />}
              aria-label="View details"
              className="bg-ods-card"
            />
          </div>
        )
      },
    }
    result.push(chevronColumn)
  }

  return result
}

export function Table<T = any>({
  data,
  columns,
  rowKey,
  loading = false,
  emptyMessage = 'No data available',
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
}: TableProps<T>) {
  const columnsWithActions = injectSyntheticColumns(columns, rowActions, renderRowActions, rowHref)
  const getRowHref = (item: T): string | undefined => {
    if (onRowClick || !rowHref) return undefined
    return rowHref(item) ?? undefined
  }
  const getRowKey = (item: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(item)
    }
    const key = item[rowKey]
    return key?.toString() || index.toString()
  }

  const getRowClassName = (item: T, index: number): string => {
    if (typeof rowClassName === 'function') {
      return rowClassName(item, index)
    }
    return rowClassName || ''
  }

  const isRowSelected = (item: T) => {
    if (!selectable || !selectedRows) return false
    const key = getRowKey(item, -1)
    return selectedRows.some(row => getRowKey(row, -1) === key)
  }

  const handleSelectRow = (item: T) => {
    if (!onSelectionChange) return

    const key = getRowKey(item, -1)
    const isSelected = isRowSelected(item)

    if (isSelected) {
      onSelectionChange(selectedRows.filter(row => getRowKey(row, -1) !== key))
    } else {
      onSelectionChange([...selectedRows, item])
    }
  }

  const handleSelectAll = () => {
    if (!onSelectionChange) return

    if (selectedRows.length === data.length) {
      onSelectionChange([])
    } else {
      onSelectionChange([...data])
    }
  }

  const allSelected = selectedRows.length > 0 && selectedRows.length === data.length
  const someSelected = selectedRows.length > 0 && selectedRows.length < data.length

  // Infinite scroll: IntersectionObserver on sentinel div
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(infiniteScroll?.onLoadMore)
  onLoadMoreRef.current = infiniteScroll?.onLoadMore

  useEffect(() => {
    if (!infiniteScroll?.hasNextPage || infiniteScroll.isFetchingNextPage) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMoreRef.current?.()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [infiniteScroll?.hasNextPage, infiniteScroll?.isFetchingNextPage])

  return (
    <div className={cn('flex flex-col gap-1 w-full', containerClassName)}>
      {/* Toolbar for bulk actions */}
      {showToolbar && bulkActions && selectedRows.length > 0 && (
        <div className="flex items-center justify-between bg-ods-card border border-ods-border rounded-[6px] p-3 mb-2">
          <span className="text-ods-text-secondary text-sm">
            {selectedRows.length} item{selectedRows.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            {bulkActions.map((action, index) => (
              <button
                key={index}
                onClick={() => action.onClick(selectedRows)}
                disabled={action.requiresSelection && selectedRows.length === 0}
                className={cn(
                  "px-3 py-1.5 text-sm rounded border transition-colors",
                  "bg-ods-card border-ods-border hover:bg-ods-bg-active text-ods-text-primary",
                  action.className
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
      <div className={cn('flex flex-col gap-2 w-full', className)}>
        {loading && data.length === 0 ? (
          <TableCardSkeleton
            columns={columns}
            rows={skeletonRows}
            hasActions={Boolean(rowActions) && rowActions!.length > 0}
            hasChevron={Boolean(rowHref)}
          />
        ) : data.length === 0 ? (
          <TableEmptyState message={emptyMessage} />
        ) : (
          <>
            {data.map((item, index) => (
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
              />
            ))}
            {/* Infinite scroll: skeleton rows */}
            {infiniteScroll?.isFetchingNextPage && (
              <TableCardSkeleton
                columns={columns}
                rows={infiniteScroll.skeletonRows ?? 3}
                hasActions={Boolean(rowActions) && rowActions!.length > 0}
                hasChevron={Boolean(rowHref)}
              />
            )}
            {/* Infinite scroll: sentinel element */}
            {infiniteScroll?.hasNextPage && (
              <div ref={sentinelRef} className="h-1" aria-hidden="true" />
            )}
            {/* Invisible placeholder rows to maintain consistent table height (disabled for infinite scroll) */}
            {!infiniteScroll && Array.from({ length: Math.max(0, skeletonRows - data.length) }).map((_, index) => (
              <div
                key={`placeholder-${index}`}
                className="relative rounded-[6px] overflow-hidden pointer-events-none"
                aria-hidden="true"
              >
                {/* Desktop placeholder - invisible but takes up space */}
                <div className={cn('hidden md:flex items-center gap-4 px-4 py-0', ROW_HEIGHT_DESKTOP)} />
                {/* Mobile placeholder - invisible but takes up space */}
                <div className={cn('flex md:hidden gap-3 items-center justify-start px-3 py-0', ROW_HEIGHT_MOBILE)} />
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
          className={cn(
            'border-t border-ods-border pt-3 mt-2',
            paginationClassName
          )}
        />
      )}

      {!infiniteScroll && pagePagination && !cursorPagination && data.length > 0 && (
        <div className={cn(
          'border-t border-ods-border pt-3 mt-2',
          paginationClassName
        )}>
          <Pagination
            currentPage={pagePagination.currentPage}
            totalPages={pagePagination.totalPages}
            onPageChange={pagePagination.onPageChange}
          />
        </div>
      )}
    </div>
  )
}