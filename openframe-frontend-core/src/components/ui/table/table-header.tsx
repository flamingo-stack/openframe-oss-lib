'use client';

import { useLgUp } from '../../../hooks/ui/use-media-query';
import { cn } from '../../../utils/cn';
import { Arrow01DownIcon } from '../../icons-v2-generated/arrows/arrow-01-down-icon';
import { Arrow01UpIcon } from '../../icons-v2-generated/arrows/arrow-01-up-icon';
import { SwitchVrIcon } from '../../icons-v2-generated/arrows/switch-vr-icon';
import { Checkbox } from '../checkbox';
import { TableColumnFilterDropdown } from './table-column-filter-dropdown';
import type { TableColumn, TableHeaderProps, TableRowData } from './types';
import { getHideClasses } from './utils';

/** @deprecated Use `DataTableHeader` from `data-table` instead. */
export function TableHeader<T = TableRowData>({
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
        return 'justify-center';
      case 'right':
        return 'justify-end';
      default:
        return 'justify-start';
    }
  };

  const handleSort = (column: TableColumn<T>) => {
    if (!column.sortable || !onSort) return;

    const columnKey = column.sortKey || column.key;
    let newDirection: 'asc' | 'desc' = 'asc';

    if (sortBy === columnKey) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }

    onSort(columnKey, newDirection);
  };

  const getSortIcon = (column: TableColumn<T>) => {
    if (!column.sortable) return null;

    const columnKey = column.sortKey || column.key;
    const isActive = sortBy === columnKey;

    if (!isActive) {
      return <SwitchVrIcon className="h-4 w-4 text-ods-text-secondary" />;
    }

    return sortDirection === 'asc' ? (
      <Arrow01UpIcon className="h-4 w-4 text-ods-accent" />
    ) : (
      <Arrow01DownIcon className="h-4 w-4 text-ods-accent" />
    );
  };

  const isLgUp = useLgUp() ?? false;

  return (
    <div
      className={cn(
        'relative hidden h-11 items-center gap-4 px-4 py-3 md:flex',
        stickyHeader && `sticky z-10 bg-ods-bg ${stickyHeaderOffset || 'top-0'}`,
        className,
      )}
    >
      {/* Selection checkbox */}
      {selectable && (
        <div className="flex w-10 shrink-0 items-center justify-center">
          <Checkbox
            checked={allSelected || (someSelected && !allSelected) ? true : false}
            onCheckedChange={onSelectAll}
            className="border-ods-border"
          />
        </div>
      )}

      {columns.map(column => {
        const isActionsColumn = column.key === '__actions__';
        const filterable = column.filterable && column.filterOptions && onFilterChange;

        // Hide columns on mobile if they are not actions or filterable
        if (!isLgUp && !isActionsColumn && !filterable) {
          return null;
        }

        return (
          <div
            key={column.key}
            className={cn(
              'flex items-center gap-2',
              isLgUp && getAlignment(column.align),
              isLgUp && (column.width || 'min-w-0 flex-1'),
              column.className,
              // Only apply hide classes if the column is not filterable or on tablet
              !(filterable && !isLgUp) && getHideClasses(column.hideAt),
              isActionsColumn && 'ml-auto',
            )}
          >
            {isActionsColumn ? (
              // Render total items count in actions column
              totalItemsCount > 0 && (
                <span className="whitespace-nowrap text-ods-text-secondary text-h6">
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
                  'flex items-center gap-2',
                  column.sortable && 'cursor-pointer transition-colors hover:text-ods-text-primary',
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
                    <span className="whitespace-nowrap uppercase text-ods-text-secondary text-h5">{column.label}</span>
                    {getSortIcon(column)}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
