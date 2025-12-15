'use client'

import React from 'react'
import { cn } from '../../../utils/cn'
import { TableHeader } from './table-header'
import { TableRow } from './table-row'
import { TableCardSkeleton, ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE } from './table-skeleton'
import { TableEmptyState } from './table-empty-state'
import { CursorPagination } from '../cursor-pagination'
import { Pagination } from '../../pagination'
import { Button } from '../button'
import type { TableProps, TableColumn, RowAction } from './types'
import type { ReactNode } from 'react'

/**
 * Injects a synthetic actions column into the columns array when row actions exist
 */
function injectActionsColumn<T>(
  columns: TableColumn<T>[],
  rowActions?: RowAction<T>[],
  renderRowActions?: (item: T) => ReactNode
): TableColumn<T>[] {
  const hasActions = !!rowActions || !!renderRowActions
  if (!hasActions) return columns

  const actionsColumn: TableColumn<T> = {
    key: '__actions__',
    label: '',
    width: 'min-w-[200px] w-auto shrink-0 flex-none',
    align: 'right',
    renderCell: (item: T) => (
      <div className="flex gap-2 items-center justify-end" data-no-row-click>
        {renderRowActions ? (
          renderRowActions(item)
        ) : (
          rowActions!.map((action, actionIndex) => (
            <Button
              key={actionIndex}
              variant={action.variant || 'outline'}
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
    renderHeader: () => <div className="text-right" />
  }

  return [...columns, actionsColumn]
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
  onRowClick,
  rowActions,
  renderRowActions,
  sortBy,
  sortDirection,
  onSort,
  filters,
  onFilterChange,
  showFilters,
  selectable,
  selectedRows = [],
  onSelectionChange,
  bulkActions,
  showToolbar,
  mobileColumns,
  renderMobileRow,
  cursorPagination,
  pagePagination,
  paginationClassName
}: TableProps<T>) {
  // Inject synthetic actions column if needed
  const columnsWithActions = injectActionsColumn(columns, rowActions, renderRowActions)
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

  return (
    <div className={cn('flex flex-col gap-1 w-full', containerClassName)}>
      {/* Toolbar for bulk actions */}
      {showToolbar && bulkActions && selectedRows.length > 0 && (
        <div className="flex items-center justify-between bg-[#212121] border border-[#3a3a3a] rounded-[6px] p-3 mb-2">
          <span className="text-[#888888] text-sm">
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
                  "bg-[#212121] border-[#3a3a3a] hover:bg-[#2a2a2a] text-[#fafafa]",
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
        showFilters={showFilters}
        selectable={selectable}
        allSelected={allSelected}
        someSelected={someSelected}
        onSelectAll={handleSelectAll}
      />

      {/* Table Body */}
      <div className={cn('flex flex-col gap-1 w-full', className)}>
        {loading ? (
          <TableCardSkeleton
            columns={columns}
            rows={skeletonRows}
            hasActions={!!rowActions && rowActions.length > 0}
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
                rowKey={rowKey}
                onClick={onRowClick}
                className={getRowClassName(item, index)}
                index={index}
                mobileColumns={mobileColumns}
                renderMobileRow={renderMobileRow}
                rowActions={rowActions}
                renderRowActions={renderRowActions}
                selectable={selectable}
                selected={isRowSelected(item)}
                onSelect={handleSelectRow}
              />
            ))}
            {/* Invisible placeholder rows to maintain consistent table height */}
            {Array.from({ length: Math.max(0, skeletonRows - data.length) }).map((_, index) => (
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

      {/* Pagination - only show when there's data */}
      {cursorPagination && data.length > 0 && (
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
            'border-t border-[#3a3a3a] pt-3 mt-2',
            paginationClassName
          )}
        />
      )}

      {pagePagination && !cursorPagination && data.length > 0 && (
        <div className={cn(
          'border-t border-[#3a3a3a] pt-3 mt-2',
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