'use client'

import { useLgUp } from '../../../hooks/ui/use-media-query'
import { cn } from '../../../utils/cn'
import { Arrow01DownIcon } from '../../icons-v2-generated/arrows/arrow-01-down-icon'
import { Arrow01UpIcon } from '../../icons-v2-generated/arrows/arrow-01-up-icon'
import { SwitchVrIcon } from '../../icons-v2-generated/arrows/switch-vr-icon'
import { Checkbox } from '../checkbox'
import { TableColumnFilterDropdown } from './table-column-filter-dropdown'
import type { TableColumn, TableHeaderProps } from './types'
import { getHideClasses } from './utils'

/** @deprecated Use `DataTableHeader` from `data-table` instead. */
export function TableHeader<T = any>({
  columns,
  className,
  sortBy,
  sortDirection,
  onSort,
  filters,
  onFilterChange,
  selectable,
  allSelected,
  someSelected,
  onSelectAll,
  totalItemsCount,
  stickyHeader,
  stickyHeaderOffset,
}: TableHeaderProps<T>) {
  const getAlignment = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'justify-center'
      case 'right':
        return 'justify-end'
      default:
        return 'justify-start'
    }
  }

  const handleSort = (column: TableColumn<T>) => {
    if (!column.sortable || !onSort) return
    
    const columnKey = column.sortKey || column.key
    let newDirection: 'asc' | 'desc' = 'asc'
    
    if (sortBy === columnKey) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    }
    
    onSort(columnKey, newDirection)
  }

  const getSortIcon = (column: TableColumn<T>) => {
    if (!column.sortable) return null
    
    const columnKey = column.sortKey || column.key
    const isActive = sortBy === columnKey
    
    if (!isActive) {
      return <SwitchVrIcon className="w-4 h-4 text-ods-text-secondary" />
    }
    
    return sortDirection === 'asc' 
      ? <Arrow01UpIcon className="w-4 h-4 text-ods-accent" />
      : <Arrow01DownIcon className="w-4 h-4 text-ods-accent" />
  }

  const isLgUp = useLgUp() ?? false

  return (
    <div
      className={cn(
        'hidden md:flex items-center gap-4 px-4 py-3 relative h-11',
        stickyHeader && `sticky z-10 bg-ods-bg ${stickyHeaderOffset || 'top-0'}`,
        className
      )}
    >
        {/* Selection checkbox */}
        {selectable && (
          <div className="flex items-center justify-center w-10 shrink-0">
            <Checkbox
              checked={allSelected || (someSelected && !allSelected) ? true : false}
              onCheckedChange={onSelectAll}
              className="border-ods-border"
            />
          </div>
        )}

        {columns.map((column) => {
          const isActionsColumn = column.key === '__actions__'
          const filterable = column.filterable && column.filterOptions && onFilterChange

          // Hide columns on mobile if they are not actions or filterable
          if (!isLgUp && !isActionsColumn && !filterable) {
            return null
          }

          return (
            <div
              key={column.key}
              className={cn(
                'flex gap-2 items-center',
                isLgUp && getAlignment(column.align),
                isLgUp && (column.width || 'flex-1 min-w-0'),
                column.className,
                // Only apply hide classes if the column is not filterable or on tablet
                !(filterable && !isLgUp) && getHideClasses(column.hideAt),
                isActionsColumn && 'ml-auto',
              )}
            >
              {isActionsColumn ? (
                // Render total items count in actions column
                totalItemsCount > 0 && (
                  <span className="text-h6 text-ods-text-secondary whitespace-nowrap">
                    Showing {totalItemsCount} {totalItemsCount === 1 ? 'result' : 'results'}
                  </span>
                )
              ) : column.filterable && column.filterOptions && onFilterChange ? (
                /* Filterable column — label + icon are both inside the dropdown trigger */
                <TableColumnFilterDropdown
                  columnKey={column.key}
                  columnLabel={column.label}
                  filterOptions={column.filterOptions}
                  filters={filters}
                  onFilterChange={onFilterChange}
                />
              ) : (
                /* Non-filterable column — regular label with optional sort */
                <div
                  className={cn(
                    'flex gap-2 items-center',
                    column.sortable && 'cursor-pointer hover:text-ods-text-primary transition-colors'
                  )}
                  onClick={() => handleSort(column)}
                >
                  {column.renderHeader ? (
                    <>
                      {column.renderHeader()}
                      {getSortIcon(column)}
                    </>
                  ) : (
                    <>
                      <span className="text-h5 text-ods-text-secondary uppercase whitespace-nowrap">
                        {column.label}
                      </span>
                      {getSortIcon(column)}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}